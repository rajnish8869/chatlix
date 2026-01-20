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
  loadMessages: (chatId: string, beforeTimestamp?: string, afterTimestamp?: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  createChat: (participants: string[]) => Promise<string | null>;
  loadContacts: () => Promise<void>;
  retryFailedMessages: () => void;
  markMessagesRead: (chatId: string, messageIds: string[]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface StatusUpdate {
  chatId: string;
  messageIds: string[];
  status: 'delivered' | 'read';
  attempts: number;
  nextRetry: number;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Refs for logic
  const pendingQueueRef = useRef<Message[]>([]);
  const statusQueueRef = useRef<StatusUpdate[]>([]);
  
  // Delta Sync & Concurrency Guards
  const lastChatSyncTimestamp = useRef<string | undefined>(undefined);
  const isFetchingChats = useRef(false);
  const isFetchingMessages = useRef<Record<string, boolean>>({});

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

  // Persist/Restore Queues
  useEffect(() => {
    const storedMsg = localStorage.getItem('sheet_chat_queue');
    if (storedMsg) pendingQueueRef.current = JSON.parse(storedMsg);

    const storedStatus = localStorage.getItem('sheet_chat_status_queue');
    if (storedStatus) {
        const parsed = JSON.parse(storedStatus);
        statusQueueRef.current = parsed.map((item: any) => ({
            ...item,
            attempts: item.attempts || 0,
            nextRetry: item.nextRetry || 0
        }));
    }
  }, []);

  const saveQueue = () => {
    localStorage.setItem('sheet_chat_queue', JSON.stringify(pendingQueueRef.current));
    localStorage.setItem('sheet_chat_status_queue', JSON.stringify(statusQueueRef.current));
  };

  const processQueue = async () => {
    if (!navigator.onLine) return;

    // 1. Process Message Queue
    const msgQueue = [...pendingQueueRef.current];
    const remainingMsgs: Message[] = [];
    
    for (const msg of msgQueue) {
      try {
        const res = await sheetService.sendMessage(msg.chat_id, msg.sender_id, msg.message, msg.message_id);
        if (res.success && res.data) {
          updateMessageState(msg.chat_id, msg.message_id, res.data);
        } else {
          msg.status = 'failed';
          remainingMsgs.push(msg);
        }
      } catch (e) {
        remainingMsgs.push(msg);
      }
    }
    pendingQueueRef.current = remainingMsgs;
    
    // 2. Process Status Queue
    const now = Date.now();
    const statusQueue = [...statusQueueRef.current];
    const remainingStatus: StatusUpdate[] = [];

    for (const update of statusQueue) {
        if (update.nextRetry > now) {
            remainingStatus.push(update);
            continue;
        }

        try {
            const res = await sheetService.updateMessageStatus(update.chatId, update.messageIds, update.status);
            if (!res.success) {
               const delay = Math.min(1000 * Math.pow(2, update.attempts), 60000);
               update.attempts += 1;
               update.nextRetry = now + delay;
               remainingStatus.push(update);
            }
        } catch (e) {
            const delay = Math.min(1000 * Math.pow(2, update.attempts), 60000);
            update.attempts += 1;
            update.nextRetry = now + delay;
            remainingStatus.push(update);
        }
    }
    statusQueueRef.current = remainingStatus;
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

  const updateLocalStatus = (chatId: string, messageIds: string[], status: 'delivered' | 'read') => {
    setMessages(prev => {
        const list = prev[chatId] || [];
        const ids = new Set(messageIds);
        return {
            ...prev,
            [chatId]: list.map(m => ids.has(m.message_id) ? { ...m, status } : m)
        }
    });
  }

  // Polling for global chat updates
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      if (!isOffline) {
          refreshChats();
          if (pendingQueueRef.current.length > 0 || statusQueueRef.current.length > 0) {
              processQueue();
          }
      }
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
    if (!user || isFetchingChats.current) return; // Concurrency guard
    
    isFetchingChats.current = true;
    setSyncing(true);
    
    try {
      // Use lastChatSyncTimestamp for Delta Sync
      const res = await sheetService.fetchChats(user.user_id, lastChatSyncTimestamp.current);
      
      if (res.success && res.data) {
        if (res.data.length > 0) {
            setChats(prev => {
                const chatMap = new Map<string, Chat>();
                prev.forEach(c => chatMap.set(c.chat_id, c));
                res.data!.forEach(c => chatMap.set(c.chat_id, c));
                
                return Array.from(chatMap.values()).sort((a, b) => {
                    const t1 = a.last_message?.timestamp || a.created_at;
                    const t2 = b.last_message?.timestamp || b.created_at;
                    return new Date(t2).getTime() - new Date(t1).getTime();
                });
            });
        }
        // Update sync timestamp (current time) to only fetch newer changes next time
        lastChatSyncTimestamp.current = new Date().toISOString();
      }
    } catch (e) {
      console.warn("Chat sync failed", e);
    } finally {
      isFetchingChats.current = false;
      setSyncing(false);
    }
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

  const loadMessages = useCallback(async (chatId: string, beforeTimestamp?: string, afterTimestamp?: string) => {
    // Basic concurrency check per chat
    if (isFetchingMessages.current[chatId]) return;
    
    isFetchingMessages.current[chatId] = true;

    try {
        const res = await sheetService.fetchMessages(chatId, 20, beforeTimestamp, afterTimestamp);
        
        if (res.success && res.data) {
          const serverMessages = res.data!;
          
          setMessages(prev => {
            const current = prev[chatId] || [];
            
            if (beforeTimestamp) {
              // Pagination: Prepend older messages
              const newIds = new Set(serverMessages.map(m => m.message_id));
              const filteredCurrent = current.filter(m => !newIds.has(m.message_id));
              return { ...prev, [chatId]: [...serverMessages, ...filteredCurrent] };
            } else if (afterTimestamp) {
              // Delta Sync: Append newer messages
              if (serverMessages.length === 0) return prev; // No changes
              
              const incomingIds = new Set(serverMessages.map(m => m.message_id));
              const filteredCurrent = current.filter(m => !incomingIds.has(m.message_id));
              const merged = [...filteredCurrent, ...serverMessages]; // current + new
              return { ...prev, [chatId]: merged };
            } else {
              // Full Refresh / Initial Load (Latest 20)
              const incomingIds = new Set(serverMessages.map(m => m.message_id));
              const pending = current.filter(m => (m.status === 'pending' || m.status === 'failed') && !incomingIds.has(m.message_id));
              return { ...prev, [chatId]: [...serverMessages, ...pending] };
            }
          });

          // Process 'Delivered' receipts
          if (user && serverMessages.length > 0) {
              const myUnconfirmedMessages = serverMessages.filter(m => 
                  m.sender_id !== user.user_id && m.status === 'sent'
              );
              if (myUnconfirmedMessages.length > 0) {
                  const ids = myUnconfirmedMessages.map(m => m.message_id);
                  statusQueueRef.current.push({ 
                      chatId, 
                      messageIds: ids, 
                      status: 'delivered', 
                      attempts: 0, 
                      nextRetry: 0 
                  });
                  saveQueue();
                  if (!isOffline) setTimeout(processQueue, 100);
              }
          }
        }
    } finally {
        isFetchingMessages.current[chatId] = false;
    }
  }, [user, isOffline]); 

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

  const markMessagesRead = (chatId: string, messageIds: string[]) => {
      if (messageIds.length === 0) return;
      updateLocalStatus(chatId, messageIds, 'read');
      statusQueueRef.current.push({ 
          chatId, 
          messageIds, 
          status: 'read',
          attempts: 0,
          nextRetry: 0
      });
      saveQueue();
      if (!isOffline) processQueue();
  };

  const retryFailedMessages = () => {
    processQueue();
  };

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