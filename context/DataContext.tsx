import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { sheetService } from '../services/sheetService';
import { DEFAULT_SETTINGS } from '../constants';

interface DataContextType {
  chats: Chat[];
  messages: Record<string, Message[]>;
  settings: AppSettings;
  syncing: boolean;
  isOffline: boolean;
  contacts: User[];
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string, beforeTimestamp?: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  createChat: (participants: string[]) => Promise<string | null>;
  loadContacts: () => Promise<void>;
  retryFailedMessages: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const pendingQueueRef = useRef<Message[]>([]);

  // Network Status Listener
  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); processQueue(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist/Restore Pending Queue
  useEffect(() => {
    const stored = localStorage.getItem('sheet_chat_queue');
    if (stored) {
      pendingQueueRef.current = JSON.parse(stored);
    }
  }, []);

  const saveQueue = () => {
    localStorage.setItem('sheet_chat_queue', JSON.stringify(pendingQueueRef.current));
  };

  // Process Offline Queue
  const processQueue = async () => {
    if (pendingQueueRef.current.length === 0 || !navigator.onLine) return;

    const queue = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    saveQueue();

    for (const msg of queue) {
      try {
        const res = await sheetService.sendMessage(msg.chat_id, msg.sender_id, msg.message, msg.message_id);
        if (res.success && res.data) {
          updateMessageState(msg.chat_id, msg.message_id, res.data);
        } else {
          msg.status = 'failed';
          pendingQueueRef.current.push(msg);
        }
      } catch (e) {
        pendingQueueRef.current.push(msg);
      }
    }
    saveQueue();
  };

  const updateMessageState = (chatId: string, oldId: string, newMsg: Message) => {
    setMessages(prev => {
      const list = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: list.map(m => m.message_id === oldId ? newMsg : m)
      };
    });
  };

  // Polling
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      if (!isOffline) refreshChats();
    }, settings.polling_interval);
    return () => clearInterval(intervalId);
  }, [user, settings.polling_interval, isOffline]);

  // Initial Load
  useEffect(() => {
    sheetService.fetchSettings().then(res => {
      if (res.success && res.data) setSettings(res.data);
    });
  }, []);

  const refreshChats = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    const res = await sheetService.fetchChats(user.user_id);
    if (res.success && res.data) {
      setChats(res.data);
    }
    setSyncing(false);
  }, [user]);

  const loadContacts = useCallback(async () => {
    if(!user) return;
    const res = await sheetService.fetchContacts(user.user_id);
    if (res.success && res.data) {
        setContacts(res.data);
    }
  }, [user]);

  const createChat = async (participants: string[]): Promise<string | null> => {
    if (!user) return null;
    // Add self to participants
    const allParticipants = Array.from(new Set([...participants, user.user_id]));
    const res = await sheetService.createChat(user.user_id, allParticipants);
    if (res.success && res.data) {
        setChats(prev => {
            if (prev.find(c => c.chat_id === res.data!.chat_id)) return prev;
            return [res.data!, ...prev];
        });
        return res.data.chat_id;
    }
    return null;
  };

  const loadMessages = useCallback(async (chatId: string, beforeTimestamp?: string) => {
    const res = await sheetService.fetchMessages(chatId, 20, beforeTimestamp);
    if (res.success && res.data) {
      setMessages(prev => {
        const current = prev[chatId] || [];
        if (beforeTimestamp) {
          const newIds = new Set(res.data!.map(m => m.message_id));
          const filteredCurrent = current.filter(m => !newIds.has(m.message_id));
          return { ...prev, [chatId]: [...res.data!, ...filteredCurrent] };
        } else {
          const incomingIds = new Set(res.data!.map(m => m.message_id));
          const pending = current.filter(m => m.status === 'pending' || m.status === 'failed');
          return { ...prev, [chatId]: [...res.data!, ...pending] };
        }
      });
    }
  }, []);

  const sendMessage = async (chatId: string, text: string) => {
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      message_id: tempId,
      chat_id: chatId,
      sender_id: user.user_id,
      message: text,
      type: 'text',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), tempMsg]
    }));

    if (isOffline) {
      pendingQueueRef.current.push(tempMsg);
      saveQueue();
      return;
    }

    try {
      const res = await sheetService.sendMessage(chatId, user.user_id, text, tempId);
      if (res.success && res.data) {
        // Immediate Update to SENT
        updateMessageState(chatId, tempId, res.data);
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      tempMsg.status = 'failed';
      pendingQueueRef.current.push(tempMsg);
      saveQueue();
      updateMessageState(chatId, tempId, tempMsg);
    }
  };

  const retryFailedMessages = () => {
    processQueue();
  };

  return (
    <DataContext.Provider value={{ chats, messages, settings, syncing, isOffline, contacts, refreshChats, loadMessages, sendMessage, retryFailedMessages, createChat, loadContacts }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};