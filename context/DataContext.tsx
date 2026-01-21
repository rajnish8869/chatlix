
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { chatService } from '../services/chatService';
import { DEFAULT_SETTINGS } from '../constants';
import { Unsubscribe } from 'firebase/firestore';
import { deriveSharedKey, decryptMessage, encryptMessage } from '../utils/crypto';

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
  decryptContent: (chatId: string, content: string, senderId: string) => Promise<string>;
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

  const chatsUnsub = useRef<Unsubscribe | null>(null);
  const messageUnsubs = useRef<Record<string, Unsubscribe>>({});
  const sharedKeysCache = useRef<Record<string, CryptoKey>>({});

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

  // --- Real-time Chat Sync & Auto-Delivery ---
  useEffect(() => {
    if (!user) {
        setChats([]);
        if (chatsUnsub.current) chatsUnsub.current();
        return;
    }

    setSyncing(true);
    chatsUnsub.current = chatService.subscribeToChats(user.user_id, (newChats) => {
        setChats(newChats);
        setSyncing(false);

        // Check for messages in the chat list that are 'sent' but not by me, and mark them delivered
        newChats.forEach(chat => {
            if (chat.last_message && 
                chat.last_message.sender_id !== user.user_id && 
                chat.last_message.status === 'sent') {
                 // Mark delivered in background
                 chatService.markAs(chat.chat_id, chat.last_message.message_id, 'delivered');
            }
        });
    });

    chatService.fetchSettings().then(res => {
        if(res.success && res.data) setSettings(res.data);
    });

    return () => {
        if (chatsUnsub.current) chatsUnsub.current();
        Object.values(messageUnsubs.current).forEach(unsub => unsub());
    };
  }, [user]);

  // --- Crypto Helpers ---
  const getSharedKey = async (otherUserId: string): Promise<CryptoKey | null> => {
      if (sharedKeysCache.current[otherUserId]) return sharedKeysCache.current[otherUserId];
      
      const myPrivKeyStr = localStorage.getItem(`chatlix_priv_${user?.user_id}`);
      const otherUser = contacts.find(c => c.user_id === otherUserId);
      
      if (myPrivKeyStr && otherUser?.publicKey) {
          try {
              const key = await deriveSharedKey(myPrivKeyStr, otherUser.publicKey);
              sharedKeysCache.current[otherUserId] = key;
              return key;
          } catch (e) {
              console.error("Key Derivation Failed", e);
          }
      }
      return null;
  };

  const decryptContent = async (chatId: string, content: string, senderId: string): Promise<string> => {
      // 1. Find Chat Type
      const chat = chats.find(c => c.chat_id === chatId);
      
      // Group chats are plaintext for now
      if (chat && chat.type === 'group') return content;
      
      // Private Chat E2EE
      const otherId = chat?.participants.find(p => p !== user?.user_id) || senderId;
      
      if (otherId === user?.user_id) { 
         // Message to self (saved messages) - tricky without storing session key. 
         // For now, if I am the sender, I should have encrypted it for the *other* person.
         // But I cannot decrypt it unless I encrypted it for *myself* too.
         // SIMPLIFICATION: In this implementation, sender can't decrypt their own history 
         // unless we store the plain text locally or encrypt for self. 
         // We will return content (assuming optimistic local update) or a placeholder.
         // Actually, deriveSharedKey(MyPriv, OtherPub) === deriveSharedKey(OtherPriv, MyPub).
         // So I CAN decrypt my own sent messages if I use the SAME shared secret logic!
         // Yes: ECDH(MyPriv, OtherPub) is the same secret used to encrypt.
         const realOtherId = chat?.participants.find(p => p !== user?.user_id);
         if (!realOtherId) return content;
         const key = await getSharedKey(realOtherId);
         if(key) return await decryptMessage(content, key);
      } else {
         const key = await getSharedKey(otherId);
         if(key) return await decryptMessage(content, key);
      }
      
      return "🔒 Encrypted Message";
  };

  const loadContacts = useCallback(async () => {
    if(!user) return;
    try {
        const response = await chatService.fetchContacts(user.user_id);
        if (response.success && response.data) {
            // Process real-time presence (mock logic for "just now")
            const now = new Date().getTime();
            const enhancedContacts = response.data.map(c => {
                const lastSeenTime = new Date(c.last_seen).getTime();
                // If last_seen is within 2 minutes, consider online
                const isOnline = (now - lastSeenTime) < 2 * 60 * 1000; 
                return { ...c, status: isOnline ? 'online' : 'offline' };
            });
            setContacts(enhancedContacts);
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

  const loadMessages = useCallback(async (chatId: string, beforeTimestamp?: string) => {
    if (messageUnsubs.current[chatId]) return;

    messageUnsubs.current[chatId] = chatService.subscribeToMessages(chatId, 100, (msgs) => {
        setMessages(prev => ({ ...prev, [chatId]: msgs }));
        
        // Auto-mark delivered if I am receiving them
        const unreadByMe = msgs.filter(m => m.sender_id !== user?.user_id && m.status === 'sent');
        if (unreadByMe.length > 0) {
            chatService.updateMessageStatus(chatId, unreadByMe.map(m => m.message_id), 'delivered');
        }
    });
  }, [user]);

  const sendMessage = async (chatId: string, text: string) => {
    if (!user || !text.trim()) return;
    
    // E2EE Logic
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

    await chatService.sendMessage(chatId, user.user_id, content, type);
  };

  const markMessagesRead = async (chatId: string, messageIds: string[]) => {
      if (messageIds.length === 0) return;
      await chatService.updateMessageStatus(chatId, messageIds, 'read');
  };

  const retryFailedMessages = () => {};
  const refreshChats = async () => {};

  return (
    <DataContext.Provider value={{ 
        chats, messages, settings, syncing, isOffline, contacts, 
        refreshChats, loadMessages, sendMessage, retryFailedMessages, 
        createChat, loadContacts, markMessagesRead, decryptContent
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
