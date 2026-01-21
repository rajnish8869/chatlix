import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { chatService } from '../services/chatService';
import { DEFAULT_SETTINGS } from '../constants';
import { Unsubscribe } from 'firebase/firestore';

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
  markMessagesRead: (chatId: string, messageIds: string[]) => void;
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

  // Subscriptions refs
  const chatsUnsub = useRef<Unsubscribe | null>(null);
  const messageUnsubs = useRef<Record<string, Unsubscribe>>({});

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Real-time Chat Sync ---
  useEffect(() => {
    if (!user) {
        setChats([]);
        if (chatsUnsub.current) chatsUnsub.current();
        return;
    }

    setSyncing(true);
    // Subscribe to chat list
    chatsUnsub.current = chatService.subscribeToChats(user.user_id, (newChats) => {
        setChats(newChats);
        setSyncing(false);
    });

    // Fetch settings
    chatService.fetchSettings().then(res => {
        if(res.success && res.data) setSettings(res.data);
    });

    return () => {
        if (chatsUnsub.current) chatsUnsub.current();
        // Cleanup all message listeners
        Object.values(messageUnsubs.current).forEach(unsub => unsub());
    };
  }, [user]);

  // --- Functions ---

  const refreshChats = async () => {
      // No-op: handled by listener
  };

  const loadContacts = useCallback(async () => {
    if(!user) return;
    try {
        const response = await chatService.fetchContacts(user.user_id);
        if (response.success && response.data) {
            setContacts(response.data);
        }
    } catch (e) {
        console.error("Error loading contacts", e);
    }
  }, [user]);

  const createChat = async (participants: string[]): Promise<string | null> => {
    if (!user) return null;
    const allParticipants = Array.from(new Set([...participants, user.user_id]));
    const response = await chatService.createChat(user.user_id, allParticipants);
    return response.success && response.data ? response.data.chat_id : null;
  };

  // Subscribe to messages when a chat is opened
  const loadMessages = useCallback(async (chatId: string, beforeTimestamp?: string) => {
    // If we are already subscribed, do nothing. 
    // Note: Pagination (beforeTimestamp) would require a separate fetch strategy or updating the subscription limit.
    // For this implementation, we rely on the subscription to the last 100 messages.
    if (messageUnsubs.current[chatId]) {
        return;
    }

    // Subscribe to this chat
    messageUnsubs.current[chatId] = chatService.subscribeToMessages(chatId, 100, (msgs) => {
        setMessages(prev => ({
            ...prev,
            [chatId]: msgs
        }));
    });
  }, []);

  const sendMessage = async (chatId: string, text: string) => {
    if (!user || !text.trim()) return;
    // We don't manually update local state here. 
    // The chatService.sendMessage triggers a local write, 
    // which fires the onSnapshot listener immediately with 'pending' status.
    await chatService.sendMessage(chatId, user.user_id, text);
  };

  const markMessagesRead = async (chatId: string, messageIds: string[]) => {
      if (messageIds.length === 0) return;
      
      // Optimistic update in UI is optional since listener is fast, 
      // but strictly relying on listener is safer for consistency.
      // However, we call the service to persist.
      await chatService.updateMessageStatus(chatId, messageIds, 'read');
  };

  const retryFailedMessages = () => {};

  return (
    <DataContext.Provider value={{ 
        chats, 
        messages, 
        settings, 
        syncing, 
        isOffline, 
        contacts, 
        refreshChats, 
        loadMessages, 
        sendMessage, 
        retryFailedMessages, 
        createChat, 
        loadContacts,
        markMessagesRead
    }}>
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