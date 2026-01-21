
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

  const chatsUnsub = useRef<Unsubscribe | null>(null);
  const contactsUnsub = useRef<Unsubscribe | null>(null);
  const messageUnsubs = useRef<Record<string, Unsubscribe>>({});
  
  // Cache stores: { [userId]: { key: CryptoKey, pubKeyStr: string } }
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

  // --- Real-time Sync (Chats + Users) ---
  useEffect(() => {
    if (!user) {
        setChats([]);
        setContacts([]);
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        return;
    }

    setSyncing(true);
    
    // 1. Subscribe to Chats
    chatsUnsub.current = chatService.subscribeToChats(user.user_id, (newChats) => {
        setChats(newChats);
        setSyncing(false);

        // Auto-mark delivered if I am receiving them
        newChats.forEach(chat => {
            if (chat.last_message && 
                chat.last_message.sender_id !== user.user_id && 
                chat.last_message.status === 'sent') {
                 chatService.markAs(chat.chat_id, chat.last_message.message_id, 'delivered');
            }
        });
    });

    // 2. Subscribe to Users (Real-time Presence)
    contactsUnsub.current = chatService.subscribeToUsers(user.user_id, (users) => {
        const now = new Date().getTime();
        const enhancedContacts = users.map(c => {
            const lastSeenTime = new Date(c.last_seen).getTime();
            // If last_seen is within 2 minutes, consider online
            const isOnline = (now - lastSeenTime) < 2 * 60 * 1000; 
            return { ...c, status: isOnline ? 'online' : 'offline' };
        });
        
        // Sort: Online first, then alphabetical
        enhancedContacts.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (a.status !== 'online' && b.status === 'online') return 1;
            return a.username.localeCompare(b.username);
        });
        
        setContacts(enhancedContacts);
    });

    // 3. Local Status Decay (Check every 15s to switch people offline if timeout)
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

  // --- Crypto Helpers ---
  const getSharedKey = async (otherUserId: string): Promise<CryptoKey | null> => {
      const myPrivKeyStr = localStorage.getItem(`chatlix_priv_${user?.user_id}`);
      // Find user from contacts list (which is kept updated via subscription)
      const otherUser = contacts.find(c => c.user_id === otherUserId);
      
      if (!myPrivKeyStr || !otherUser?.publicKey) return null;

      // Check cache validity
      const cached = sharedKeysCache.current[otherUserId];
      if (cached && cached.pubKeyStr === otherUser.publicKey) {
          return cached.key;
      }

      try {
          // Derive new key
          const key = await deriveSharedKey(myPrivKeyStr, otherUser.publicKey);
          // Update cache
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
      
      // Determine whose key we need to establish the shared secret.
      // E2EE logic: Shared Secret = ECDH(MyPriv, OtherPub) == ECDH(OtherPriv, MyPub)
      
      const otherId = chat?.participants.find(p => p !== user?.user_id) || senderId;
      
      if (otherId === user?.user_id) { 
         // I am the sender. To decrypt my own message, I need the Shared Secret I used to encrypt it.
         // That secret was derived from MyPriv + ReceiverPub.
         // I need to find who the receiver was.
         const realOtherId = chat?.participants.find(p => p !== user?.user_id);
         if (!realOtherId) return content; // Self-chat or error
         
         const key = await getSharedKey(realOtherId);
         if(key) return await decryptMessage(content, key);
      } else {
         // I am the receiver. Sender is `otherId`.
         // I derive secret from MyPriv + SenderPub.
         const key = await getSharedKey(otherId);
         if(key) return await decryptMessage(content, key);
      }
      return "🔒 Encrypted Message (Key Mismatch)";
  };

  const loadContacts = useCallback(async () => {
    // Handled by real-time subscription
  }, []);

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
        
        const unreadByMe = msgs.filter(m => m.sender_id !== user?.user_id && m.status === 'sent');
        if (unreadByMe.length > 0) {
            chatService.updateMessageStatus(chatId, unreadByMe.map(m => m.message_id), 'delivered');
        }
    });
  }, [user]);

  const sendMessage = async (chatId: string, text: string) => {
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

    await chatService.sendMessage(chatId, user.user_id, content, type);
  };

  const markMessagesRead = async (chatId: string, messageIds: string[]) => {
      if (messageIds.length === 0) return;
      await chatService.updateMessageStatus(chatId, messageIds, 'read');
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
        refreshChats, loadMessages, sendMessage, retryFailedMessages, 
        createChat, loadContacts, markMessagesRead, decryptContent,
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
