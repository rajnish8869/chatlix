
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { chatService } from '../services/chatService';
import { DEFAULT_SETTINGS } from '../constants';
import { 
    deriveSharedKey, 
    decryptMessage, 
    encryptMessage, 
    generateSymmetricKey, 
    exportKeyToString, 
    importKeyFromString 
} from '../utils/crypto';
import { SecureStorage } from '../utils/storage';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../services/firebase'; // Direct db access for user key fetching if needed

// Type alias for unsubscribe function
type UnsubscribeFunc = () => void;

interface DataContextType {
  chats: Chat[];
  messages: Record<string, Message[]>;
  settings: AppSettings;
  syncing: boolean;
  isOffline: boolean;
  contacts: User[];
  typingStatus: Record<string, string[]>; // chatId -> userIds[]
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string, replyTo?: Message['replyTo']) => Promise<void>;
  sendImage: (chatId: string, file: File) => Promise<void>;
  toggleReaction: (chatId: string, messageId: string, reaction: string) => Promise<void>;
  setTyping: (chatId: string, isTyping: boolean) => Promise<void>;
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
  // We keep raw firestore users separately so we can merge with RTDB status
  const [rawFirestoreUsers, setRawFirestoreUsers] = useState<User[]>([]);
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, any>>({});

  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Typing Status State
  const [typingStatus, setTypingStatusState] = useState<Record<string, string[]>>({});
  
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  const chatsUnsub = useRef<UnsubscribeFunc | null>(null);
  const contactsUnsub = useRef<UnsubscribeFunc | null>(null);
  const presenceUnsub = useRef<UnsubscribeFunc | null>(null);
  const messageUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  const typingUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  
  const sharedKeysCache = useRef<Record<string, { key: CryptoKey, pubKeyStr: string }>>({});
  const groupKeysCache = useRef<Record<string, CryptoKey>>({});

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

  // Sync Typing Listeners with Chats
  useEffect(() => {
      // For every chat in the list, subscribe to typing status
      chats.forEach(chat => {
          if (!typingUnsubs.current[chat.chat_id]) {
              typingUnsubs.current[chat.chat_id] = chatService.subscribeToChatTyping(chat.chat_id, (userIds) => {
                  setTypingStatusState(prev => ({
                      ...prev,
                      [chat.chat_id]: userIds
                  }));
              });
          }
      });
  }, [chats]);

  // Combine Firestore Profiles + RTDB Presence
  useEffect(() => {
    if (rawFirestoreUsers.length === 0) {
        setContacts([]);
        return;
    }

    const mergedContacts = rawFirestoreUsers.map(u => {
        const presence = rtdbPresence[u.user_id];
        return {
            ...u,
            status: presence?.state || 'offline',
            // Prefer RTDB timestamp for accuracy, fallback to Firestore
            last_seen: presence?.last_changed ? new Date(presence.last_changed).toISOString() : u.last_seen
        };
    });

    // Sort: Online first, then alphabetical
    mergedContacts.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.username.localeCompare(b.username);
    });

    setContacts(mergedContacts);
  }, [rawFirestoreUsers, rtdbPresence]);


  useEffect(() => {
    if (!user) {
        setChats([]);
        setContacts([]);
        setRawFirestoreUsers([]);
        setRtdbPresence({});
        setTypingStatusState({});
        groupKeysCache.current = {};
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        if (presenceUnsub.current) presenceUnsub.current();
        // Cleanup typing subs
        Object.values(typingUnsubs.current).forEach((unsub: any) => {
            if (typeof unsub === 'function') unsub();
        });
        typingUnsubs.current = {};
        return;
    }

    setSyncing(true);
    
    // 1. Subscribe to Chats
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

    // 2. Subscribe to Users (Firestore Profile Data)
    contactsUnsub.current = chatService.subscribeToUsers(user.user_id, (users) => {
        setRawFirestoreUsers(users);
    }) as UnsubscribeFunc;

    // 3. Subscribe to Global Presence (RTDB)
    presenceUnsub.current = chatService.subscribeToGlobalPresence((presenceMap) => {
        setRtdbPresence(presenceMap);
    }) as unknown as UnsubscribeFunc;

    if (chatService.fetchSettings) {
        chatService.fetchSettings().then(res => {
            if(res.success && res.data) setSettings(res.data);
        });
    }

    return () => {
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        if (presenceUnsub.current) presenceUnsub.current();
        Object.values(messageUnsubs.current).forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        Object.values(typingUnsubs.current).forEach((unsub: any) => {
             if (typeof unsub === 'function') unsub();
        });
    };
  }, [user]);

  // Retrieve 1-on-1 Shared Secret
  const getSharedKey = async (otherUserId: string): Promise<CryptoKey | null> => {
      const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user?.user_id}`);
      // Find contact in contacts state (which has merged data)
      let otherUser = contacts.find(c => c.user_id === otherUserId);

      // Fallback: If contact not in list (e.g. fresh group load), try fetch from Firestore?
      // Since contacts is populated via subscription, it should be there.
      
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
      if (!chat) return content;

      // --- GROUP CHAT DECRYPTION ---
      if (chat.type === 'group') {
          // If no E2EE setup for this group (legacy), return raw
          if (!chat.encrypted_keys || !chat.key_issuer_id) return content;

          if (groupKeysCache.current[chatId]) {
              return await decryptMessage(content, groupKeysCache.current[chatId]);
          }

          const myEncryptedKey = chat.encrypted_keys[user?.user_id || ''];
          if (!myEncryptedKey) return "🔒 Access Denied (No Key)";

          try {
              // The key was encrypted by the Issuer for Me.
              // So I decrypt using Shared(Me, Issuer).
              // Note: If I am the Issuer, Shared(Me, Me) is valid.
              const sharedKey = await getSharedKey(chat.key_issuer_id);
              if (!sharedKey) return "🔒 Key Failure";

              const groupKeyStr = await decryptMessage(myEncryptedKey, sharedKey);
              if (groupKeyStr.startsWith("🔒")) return "🔒 Decryption Error";

              const groupKey = await importKeyFromString(groupKeyStr);
              groupKeysCache.current[chatId] = groupKey;
              
              return await decryptMessage(content, groupKey);
          } catch (e) {
              return "🔒 Decryption Failed";
          }
      } 
      
      // --- PRIVATE CHAT DECRYPTION ---
      const otherId = chat.participants.find(p => p !== user?.user_id) || senderId;
      if (otherId === user?.user_id) { 
         // Chat with self
         const key = await getSharedKey(user?.user_id || '');
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
    const isGroup = allParticipants.length > 2 || !!groupName;

    let encryptedKeysPayload: Record<string, string> | undefined = undefined;

    if (isGroup) {
        // 1. Generate Group Key
        const groupKey = await generateSymmetricKey();
        const groupKeyStr = await exportKeyToString(groupKey);

        // 2. Encrypt Group Key for each participant
        encryptedKeysPayload = {};
        const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);

        if (!myPrivKeyStr) {
            console.error("Cannot create encrypted group: Missing private key");
            return null;
        }

        // We need public keys for all participants.
        
        for (const pId of allParticipants) {
             let pUser = contacts.find(c => c.user_id === pId);
             if (pId === user.user_id) pUser = user;
             
             if (!pUser && pId !== user.user_id) {
                 // Fetch missing user public key
                 const docRef = doc(db, 'users', pId);
                 const snap = await getDoc(docRef);
                 if (snap.exists()) pUser = snap.data() as User;
             }

             if (pUser?.publicKey) {
                 // Derive shared secret
                 const shared = await deriveSharedKey(myPrivKeyStr, pUser.publicKey);
                 const encryptedKey = await encryptMessage(groupKeyStr, shared);
                 encryptedKeysPayload[pId] = encryptedKey;
             } else {
                 console.warn(`Skipping encryption for ${pId}: No public key`);
             }
        }
    }

    const response = await chatService.createChat(user.user_id, allParticipants, groupName, encryptedKeysPayload);
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
    
    if (chat) {
        if (chat.type === 'private') {
            const otherId = chat.participants.find(p => p !== user.user_id);
            if (otherId) {
                const key = await getSharedKey(otherId);
                if (key) {
                    content = await encryptMessage(text, key);
                    type = 'encrypted';
                }
            }
        } else if (chat.type === 'group' && chat.encrypted_keys) {
            if (!groupKeysCache.current[chatId]) {
                 await decryptContent(chatId, "WARMUP", user.user_id);
            }
            
            const groupKey = groupKeysCache.current[chatId];
            if (groupKey) {
                content = await encryptMessage(text, groupKey);
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
  
  const toggleReaction = async (chatId: string, messageId: string, reaction: string) => {
      if (!user) return;
      await chatService.toggleReaction(chatId, messageId, user.user_id, reaction);
  };
  
  const setTyping = async (chatId: string, isTyping: boolean) => {
      if (!user) return;
      await chatService.setTypingStatus(chatId, user.user_id, isTyping);
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
        chats, messages, settings, syncing, isOffline, contacts, typingStatus,
        refreshChats, loadMessages, loadMoreMessages, sendMessage, sendImage, retryFailedMessages, 
        createChat, loadContacts, markChatAsRead, decryptContent, toggleReaction, setTyping,
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
