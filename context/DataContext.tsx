
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { chatService } from '../services/chatService';
import { DEFAULT_SETTINGS } from '../constants';
import { deriveSharedKey, decryptMessage, encryptMessage } from '../utils/crypto';

// Type alias for unsubscribe function
type UnsubscribeFunc = () => void;

interface DataContextType {
  chats: Chat[];
  messages: Record<string, Message[]>;
  settings: AppSettings;
  syncing: boolean;
  isOffline: boolean;
  contacts: User[];
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string, replyTo?: Message['replyTo']) => Promise<void>;
  sendImage: (chatId: string, file: File) => Promise<void>;
  createChat: (participants: string[], groupName?: string) => Promise<string | null>;
  loadContacts: () => Promise<void>;
  retryFailedMessages: () => void;
  markChatAsRead: (chatId: string) => Promise<void>;
  decryptContent: (chatId: string, content: string, senderId: string) => Promise<string>;
  deleteChats: (chatIds: string[]) => Promise<void>;
  deleteMessages: (chatId: string, messageIds: string[]) => Promise<void>;
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
  
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  // Use explicit function type instead of imported Unsubscribe interface to avoid call signature errors
  const chatsUnsub = useRef<UnsubscribeFunc | null>(null);
  const contactsUnsub = useRef<UnsubscribeFunc | null>(null);
  const messageUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  
  const sharedKeysCache = useRef<Record<string, { key: CryptoKey, pubKeyStr: string }>>({});

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

  useEffect(() => {
    if (!user) {
        setChats([]);
        setContacts([]);
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        return;
    }

    setSyncing(true);
    
    // Explicitly cast the return value to UnsubscribeFunc (function) if necessary, 
    // though the chatService returns a function.
    chatsUnsub.current = chatService.subscribeToChats(user.user_id, (newChats) => {
        setChats(newChats);
        setSyncing(false);

        newChats.forEach(chat => {
            if (chat.last_message && 
                chat.last_message.sender_id !== user.user_id && 
                chat.last_message.status === 'sent') {
                 chatService.markChatDelivered(chat.chat_id, user.user_id);
            }
        });
    }) as UnsubscribeFunc;

    contactsUnsub.current = chatService.subscribeToUsers(user.user_id, (users) => {
        const now = new Date().getTime();
        const enhancedContacts = users.map(c => {
            const lastSeenTime = new Date(c.last_seen).getTime();
            const isOnline = (now - lastSeenTime) < 2 * 60 * 1000; 
            return { ...c, status: isOnline ? 'online' : 'offline' };
        });
        
        enhancedContacts.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (a.status !== 'online' && b.status === 'online') return 1;
            return a.username.localeCompare(b.username);
        });
        
        setContacts(enhancedContacts);
    }) as UnsubscribeFunc;

    const decayTimer = setInterval(() => {
        setContacts(prev => {
             const now = new Date().getTime();
             let changed = false;
             const next = prev.map(c => {
                 const lastSeenTime = new Date(c.last_seen).getTime();
                 const isOnline = (now - lastSeenTime) < 2 * 60 * 1000;
                 if (c.status === 'online' && !isOnline) {
                     changed = true;
                     return { ...c, status: 'offline' };
                 }
                 return c;
             });
             return changed ? next : prev;
        });
    }, 15000);

    chatService.fetchSettings().then(res => {
        if(res.success && res.data) setSettings(res.data);
    });

    return () => {
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        clearInterval(decayTimer);
        Object.values(messageUnsubs.current).forEach(unsub => unsub());
    };
  }, [user]);

  const getSharedKey = async (otherUserId: string): Promise<CryptoKey | null> => {
      const myPrivKeyStr = localStorage.getItem(`chatlix_priv_${user?.user_id}`);
      const otherUser = contacts.find(c => c.user_id === otherUserId);
      
      if (!myPrivKeyStr || !otherUser?.publicKey) return null;

      const cached = sharedKeysCache.current[otherUserId];
      if (cached && cached.pubKeyStr === otherUser.publicKey) {
          return cached.key;
      }

      try {
          const key = await deriveSharedKey(myPrivKeyStr, otherUser.publicKey);
          sharedKeysCache.current[otherUserId] = { key, pubKeyStr: otherUser.publicKey };
          return key;
      } catch (e) {
          console.error("Key Derivation Failed", e);
          return null;
      }
  };

  const decryptContent = async (chatId: string, content: string, senderId: string): Promise<string> => {
      const chat = chats.find(c => c.chat_id === chatId);
      if (chat && chat.type === 'group') return content;
      
      const otherId = chat?.participants.find(p => p !== user?.user_id) || senderId;
      
      if (otherId === user?.user_id) { 
         const realOtherId = chat?.participants.find(p => p !== user?.user_id);
         if (!realOtherId) return content;
         
         const key = await getSharedKey(realOtherId);
         if(key) return await decryptMessage(content, key);
      } else {
         const key = await getSharedKey(otherId);
         if(key) return await decryptMessage(content, key);
      }
      return "🔒 Encrypted Message (Key Mismatch)";
  };

  const loadContacts = useCallback(async () => {
  }, []);

  const createChat = async (participants: string[], groupName?: string): Promise<string | null> => {
    if (!user) return null;
    const allParticipants = Array.from(new Set([...participants, user.user_id]));
    const response = await chatService.createChat(user.user_id, allParticipants, groupName);
    return response.success && response.data ? response.data.chat_id : null;
  };

  const loadMessages = useCallback(async (chatId: string) => {
    if (messageUnsubs.current[chatId]) return;

    // Listen to the latest 50 messages in real-time
    messageUnsubs.current[chatId] = chatService.subscribeToMessages(chatId, 50, (incomingMsgs) => {
        setMessages(prev => {
            const currentMsgs = prev[chatId] || [];
            
            // Merge logic: Create a map to deduplicate by ID
            // We prioritize the incoming (real-time/updated) data
            const msgMap = new Map();
            
            // Populate with existing messages first
            currentMsgs.forEach(m => msgMap.set(m.message_id, m));
            
            // Overwrite/Add with new messages
            incomingMsgs.forEach(m => msgMap.set(m.message_id, m));
            
            // Convert back to array and sort chronologically
            const merged = Array.from(msgMap.values()).sort((a: Message, b: Message) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            return { ...prev, [chatId]: merged };
        });
    }) as UnsubscribeFunc;
  }, [user]);

  const loadMoreMessages = async (chatId: string) => {
      if (loadingHistory[chatId]) return;
      
      const currentMsgs = messages[chatId];
      if (!currentMsgs || currentMsgs.length === 0) return;

      const oldestMsg = currentMsgs[0];
      
      setLoadingHistory(prev => ({ ...prev, [chatId]: true }));
      
      try {
          const res = await chatService.fetchHistory(chatId, oldestMsg.timestamp);
          if (res.success && res.data && res.data.length > 0) {
              const historyMsgs = res.data;
              setMessages(prev => {
                  const current = prev[chatId] || [];
                  // Prepend history. Since history is older, we put it first.
                  // But to be safe against overlap, we use the Map method again.
                  const msgMap = new Map();
                  
                  // Add history first
                  historyMsgs.forEach(m => msgMap.set(m.message_id, m));
                  // Add/Overwrite with current (which contains latest status updates)
                  current.forEach(m => msgMap.set(m.message_id, m));
                  
                  const merged = Array.from(msgMap.values()).sort((a: Message, b: Message) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );

                  return { ...prev, [chatId]: merged };
              });
          }
      } catch (e) {
          console.error("Failed to load history", e);
      } finally {
          setLoadingHistory(prev => ({ ...prev, [chatId]: false }));
      }
  };

  const sendMessage = async (chatId: string, text: string, replyTo?: Message['replyTo']) => {
    if (!user || !text.trim()) return;
    
    let content = text;
    let type: 'text' | 'encrypted' = 'text';
    
    const chat = chats.find(c => c.chat_id === chatId);
    if (chat && chat.type === 'private') {
        const otherId = chat.participants.find(p => p !== user.user_id);
        if (otherId) {
            const key = await getSharedKey(otherId);
            if (key) {
                content = await encryptMessage(text, key);
                type = 'encrypted';
            }
        }
    }

    await chatService.sendMessage(chatId, user.user_id, content, type, replyTo);
  };

  const sendImage = async (chatId: string, file: File) => {
      if (!user) return;
      try {
          const downloadUrl = await chatService.uploadImage(chatId, file);
          await chatService.sendMessage(chatId, user.user_id, downloadUrl, 'image');
      } catch (e) {
          console.error("Failed to send image", e);
      }
  };

  const markChatAsRead = async (chatId: string) => {
      if (!user) return;
      await chatService.markChatRead(chatId, user.user_id);
  };

  const deleteChats = async (chatIds: string[]) => {
      if(!user) return;
      await chatService.deleteChats(user.user_id, chatIds);
  };

  const deleteMessages = async (chatId: string, messageIds: string[]) => {
      await chatService.deleteMessages(chatId, messageIds);
  };

  const retryFailedMessages = () => {};
  const refreshChats = async () => {};

  return (
    <DataContext.Provider value={{ 
        chats, messages, settings, syncing, isOffline, contacts, 
        refreshChats, loadMessages, loadMoreMessages, sendMessage, sendImage, retryFailedMessages, 
        createChat, loadContacts, markChatAsRead, decryptContent,
        deleteChats, deleteMessages
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
