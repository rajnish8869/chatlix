import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User, ApiResponse, Wallpaper, CallSession } from '../types';
import { useAuth } from './AuthContext';
import { chatService } from '../services/chatService';
import { databaseService } from '../services/databaseService';
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
import { db } from '../services/firebase'; 
import { notificationService } from '../services/notificationService';

// Type alias for unsubscribe function
type UnsubscribeFunc = () => void;

interface QueueItem {
    id: string; // The generated message ID
    chatId: string;
    senderId: string;
    content: string;
    type: 'text' | 'encrypted' | 'image' | 'audio';
    replyTo?: Message['replyTo'];
    timestamp: number;
    dbId?: number; // Internal SQLite ID for deletion
}

interface DataContextType {
  chats: Chat[];
  messages: Record<string, Message[]>;
  callHistory: CallSession[];
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
  sendAudio: (chatId: string, blob: Blob) => Promise<void>;
  toggleReaction: (chatId: string, messageId: string, reaction: string) => Promise<void>;
  setTyping: (chatId: string, isTyping: boolean) => Promise<void>;
  createChat: (participants: string[], groupName?: string) => Promise<string | null>;
  loadContacts: () => Promise<void>;
  retryFailedMessages: () => void;
  markChatAsRead: (chatId: string) => Promise<void>;
  decryptContent: (chatId: string, content: string, senderId: string) => Promise<string>;
  deleteChats: (chatIds: string[]) => Promise<void>;
  deleteMessages: (chatId: string, messageIds: string[]) => Promise<void>;
  getMessage: (chatId: string, messageId: string) => Promise<ApiResponse<Message>>;
  updateGroupInfo: (chatId: string, name?: string, imageFile?: File) => Promise<void>;
  addGroupMember: (chatId: string, newUserId: string) => Promise<void>;
  removeGroupMember: (chatId: string, userIdToRemove: string) => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserId: string) => Promise<void>;
  setWallpaper: (chatId: string, wallpaper: Wallpaper | null, isGroupShared: boolean) => Promise<void>;
  uploadWallpaper: (file: File) => Promise<string>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [rawFirestoreUsers, setRawFirestoreUsers] = useState<User[]>([]);
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, any>>({});
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);

  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Offline Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  
  // Typing Status State
  const [typingStatus, setTypingStatusState] = useState<Record<string, string[]>>({});
  
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  const chatsUnsub = useRef<UnsubscribeFunc | null>(null);
  const callsUnsub = useRef<UnsubscribeFunc | null>(null);
  const contactsUnsub = useRef<UnsubscribeFunc | null>(null);
  const presenceUnsub = useRef<UnsubscribeFunc | null>(null);
  const messageUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  const typingUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  
  const sharedKeysCache = useRef<Record<string, { key: CryptoKey, pubKeyStr: string }>>({});
  const groupKeysCache = useRef<Record<string, CryptoKey>>({});

  // 1. Load Queue from SQLite
  useEffect(() => {
      const loadQueue = async () => {
          const dbQueue = await databaseService.getQueue();
          const mappedQueue: QueueItem[] = dbQueue.map(item => ({
              ...item.payload,
              dbId: item.id
          }));
          setQueue(mappedQueue);
      };
      loadQueue();
  }, []);

  const processQueue = useCallback(async () => {
      if (queue.length === 0 || !navigator.onLine) return;
      
      const currentQueue = [...queue];
      const newQueue = [];

      for (const item of currentQueue) {
          try {
              await chatService.sendMessage(
                  item.chatId,
                  item.senderId,
                  item.content,
                  item.type,
                  item.replyTo,
                  item.id
              );
              // Remove from DB if successful
              if (item.dbId) await databaseService.removeFromQueue(item.dbId);
          } catch (e) {
              console.error("Failed to process queue item", item.id);
              newQueue.push(item);
          }
      }
      setQueue(newQueue);
  }, [queue]);

  useEffect(() => {
    const handleOnline = () => {
        setIsOffline(false);
        processQueue();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (navigator.onLine) {
        processQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  // Sync Typing Listeners
  useEffect(() => {
      chats.forEach(chat => {
          if (!typingUnsubs.current[chat.chat_id]) {
              typingUnsubs.current[chat.chat_id] = chatService.subscribeToChatTyping(chat.chat_id, (userIds) => {
                  const blocked = user?.blocked_users || [];
                  const filteredIds = userIds.filter(id => !blocked.includes(id));
                  setTypingStatusState(prev => ({
                      ...prev,
                      [chat.chat_id]: filteredIds
                  }));
              });
          }
      });
  }, [chats, user?.blocked_users]); 

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
            last_seen: presence?.last_changed ? new Date(presence.last_changed).toISOString() : u.last_seen
        };
    });

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
        setCallHistory([]);
        setContacts([]);
        setRawFirestoreUsers([]);
        setRtdbPresence({});
        setTypingStatusState({});
        groupKeysCache.current = {};
        if (chatsUnsub.current) chatsUnsub.current();
        if (callsUnsub.current) callsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        if (presenceUnsub.current) presenceUnsub.current();
        Object.values(typingUnsubs.current).forEach((unsub: any) => {
            if (typeof unsub === 'function') unsub();
        });
        typingUnsubs.current = {};
        return;
    }

    setSyncing(true);
    
    // Initial Load from SQLite
    const loadLocalChats = async () => {
        const localChats = await databaseService.getChats();
        if (localChats.length > 0) {
            setChats(localChats);
        }
    };
    loadLocalChats();

    // 1. Subscribe to Chats
    chatsUnsub.current = chatService.subscribeToChats(user.user_id, (newChats) => {
        setChats(newChats);
        databaseService.saveChats(newChats); // Sync to DB
        setSyncing(false);

        newChats.forEach(chat => {
            if (chat.last_message && 
                chat.last_message.sender_id !== user.user_id && 
                chat.last_message.status === 'sent') {
                 if (!user.blocked_users?.includes(chat.last_message.sender_id)) {
                    chatService.markChatDelivered(chat.chat_id, user.user_id);
                 }
            }
        });
    }) as UnsubscribeFunc;
    
    // 2. Subscribe to Call History
    callsUnsub.current = chatService.subscribeToCallHistory(user.user_id, (history) => {
        setCallHistory(history);
    }) as UnsubscribeFunc;

    // 3. Subscribe to Users
    contactsUnsub.current = chatService.subscribeToUsers(user.user_id, (users) => {
        setRawFirestoreUsers(users);
    }) as UnsubscribeFunc;

    // 4. Subscribe to Global Presence
    presenceUnsub.current = chatService.subscribeToGlobalPresence((presenceMap) => {
        setRtdbPresence(presenceMap);
    }) as unknown as UnsubscribeFunc;

    return () => {
        if (chatsUnsub.current) chatsUnsub.current();
        if (callsUnsub.current) callsUnsub.current();
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

  const getSharedKey = async (otherUserId: string): Promise<CryptoKey | null> => {
      if (!user) return null;
      const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);
      if (!myPrivKeyStr) return null;

      let targetPubKey = '';

      if (otherUserId === user.user_id) {
          targetPubKey = user.publicKey || '';
      } 
      else {
          const contact = contacts.find(c => c.user_id === otherUserId);
          if (contact) {
              targetPubKey = contact.publicKey || '';
          } else {
              // Try to find in raw users or fetch
              const raw = rawFirestoreUsers.find(u => u.user_id === otherUserId);
              if (raw?.publicKey) {
                  targetPubKey = raw.publicKey;
              } else {
                  // Last resort fetch
                  try {
                    const docRef = doc(db, 'users', otherUserId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) targetPubKey = (snap.data() as User).publicKey || '';
                  } catch(e) {}
              }
          }
      }

      if (!targetPubKey) return null;

      const cached = sharedKeysCache.current[otherUserId];
      if (cached && cached.pubKeyStr === targetPubKey) {
          return cached.key;
      }

      try {
          const key = await deriveSharedKey(myPrivKeyStr, targetPubKey);
          sharedKeysCache.current[otherUserId] = { key, pubKeyStr: targetPubKey };
          return key;
      } catch (e) {
          console.error("Key Derivation Failed", e);
          return null;
      }
  };

  const decryptContent = async (chatId: string, content: string, senderId: string): Promise<string> => {
      const chat = chats.find(c => c.chat_id === chatId);
      if (!chat) return content;

      if (chat.type === 'group') {
          if (!chat.encrypted_keys || !chat.key_issuer_id) return content;

          if (groupKeysCache.current[chatId]) {
              try {
                 return await decryptMessage(content, groupKeysCache.current[chatId]);
              } catch (e) {
                 groupKeysCache.current[chatId] = undefined as any;
              }
          }

          const myEncryptedKey = chat.encrypted_keys[user?.user_id || ''];
          if (!myEncryptedKey) return "🔒 Access Denied (No Key)";

          try {
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
      
      const otherId = chat.participants.find(p => p !== user?.user_id);
      
      if (otherId) {
          const key = await getSharedKey(otherId);
          if (key) return await decryptMessage(content, key);
      } 
      else if (chat.participants.includes(user?.user_id || '')) {
          const key = await getSharedKey(user?.user_id || '');
          if (key) return await decryptMessage(content, key);
      }
      
      return "🔒 Encrypted Message";
  };

  const loadContacts = useCallback(async () => {
  }, []);

  const createChat = async (participants: string[], groupName?: string): Promise<string | null> => {
    if (!user) return null;
    const allParticipants = Array.from(new Set([...participants, user.user_id]));
    const isGroup = allParticipants.length > 2 || !!groupName;

    let encryptedKeysPayload: Record<string, string> | undefined = undefined;

    if (isGroup) {
        const groupKey = await generateSymmetricKey();
        const groupKeyStr = await exportKeyToString(groupKey);
        encryptedKeysPayload = {};
        const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);

        if (!myPrivKeyStr) return null;
        
        for (const pId of allParticipants) {
             let pUser = contacts.find(c => c.user_id === pId);
             if (pId === user.user_id) pUser = user;
             
             if (!pUser && pId !== user.user_id) {
                 const docRef = doc(db, 'users', pId);
                 const snap = await getDoc(docRef);
                 if (snap.exists()) pUser = snap.data() as User;
             }

             if (pUser?.publicKey) {
                 const shared = await deriveSharedKey(myPrivKeyStr, pUser.publicKey);
                 const encryptedKey = await encryptMessage(groupKeyStr, shared);
                 encryptedKeysPayload[pId] = encryptedKey;
             }
        }
    }

    const response = await chatService.createChat(user.user_id, allParticipants, groupName, encryptedKeysPayload);
    return response.success && response.data ? response.data.chat_id : null;
  };

  const loadMessages = useCallback(async (chatId: string) => {
    // 1. Load from SQLite first
    const localMsgs = await databaseService.getMessages(chatId, 50);
    setMessages(prev => ({ ...prev, [chatId]: localMsgs }));

    if (messageUnsubs.current[chatId]) return;

    // 2. Subscribe to Firestore updates
    messageUnsubs.current[chatId] = chatService.subscribeToMessages(chatId, 50, (incomingMsgs, removedIds) => {
        // Persist incoming to SQLite
        databaseService.saveMessagesBulk(incomingMsgs);
        if (removedIds.length > 0) {
            databaseService.deleteMessages(removedIds);
        }

        setMessages(prev => {
            const currentMsgs = prev[chatId] || [];
            let filteredMsgs = currentMsgs;
            if (removedIds && removedIds.length > 0) {
                 filteredMsgs = currentMsgs.filter(m => !removedIds.includes(m.message_id));
            }
            
            const msgMap = new Map();
            filteredMsgs.forEach(m => msgMap.set(m.message_id, m));
            incomingMsgs.forEach(m => msgMap.set(m.message_id, m));
            
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
          // 1. Try SQLite Pagination
          const offset = currentMsgs.length;
          const localHistory = await databaseService.getMessages(chatId, 50, offset);

          if (localHistory.length >= 20) {
              // Found enough in DB
              setMessages(prev => ({
                  ...prev,
                  [chatId]: [...localHistory, ...prev[chatId]]
              }));
          } else {
              // 2. Fetch from Network
              const res = await chatService.fetchHistory(chatId, oldestMsg.timestamp);
              if (res.success && res.data && res.data.length > 0) {
                  // Save fetched history to DB
                  await databaseService.saveMessagesBulk(res.data);
                  
                  // Combine with what we found in DB
                  const combined = [...res.data, ...localHistory];
                  // Dedup
                  const msgMap = new Map();
                  combined.forEach(m => msgMap.set(m.message_id, m));
                  const finalHistory = Array.from(msgMap.values()).sort((a: Message, b: Message) => 
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );

                  setMessages(prev => ({
                      ...prev,
                      [chatId]: [...finalHistory, ...prev[chatId]]
                  }));
              }
          }
      } catch (e) {
          console.error("Failed to load history", e);
      } finally {
          setLoadingHistory(prev => ({ ...prev, [chatId]: false }));
      }
  };

  const getMessage = async (chatId: string, messageId: string) => {
      // Try DB first
      const localMsgs = await databaseService.getMessages(chatId, 1000); // Hacky find
      const found = localMsgs.find(m => m.message_id === messageId);
      if (found) return { success: true, data: found };

      return chatService.getMessage(chatId, messageId);
  };

  const sendMessage = async (chatId: string, text: string, replyTo?: Message['replyTo']) => {
    if (!user || !text.trim()) return;
    
    // ... Encryption Logic (same as before) ...
    const chat = chats.find(c => c.chat_id === chatId);
    if (chat && chat.type === 'private') {
         const otherId = chat.participants.find(p => p !== user.user_id);
         if (otherId && user.blocked_users?.includes(otherId)) return;
         const otherUser = contacts.find(c => c.user_id === otherId);
         if (otherUser && otherUser.blocked_users?.includes(user.user_id)) return;
    }

    let content = text;
    let type: 'text' | 'encrypted' = 'text';

    if (chat) {
        if (chat.type === 'private') {
            const otherId = chat.participants.find(p => p !== user.user_id);
            if (otherId) {
                const key = await getSharedKey(otherId);
                if (key) { content = await encryptMessage(text, key); type = 'encrypted'; }
            } else if (chat.participants.length === 1 && chat.participants[0] === user.user_id) {
                 const key = await getSharedKey(user.user_id);
                 if (key) { content = await encryptMessage(text, key); type = 'encrypted'; }
            }
        } else if (chat.type === 'group' && chat.encrypted_keys) {
            if (!groupKeysCache.current[chatId]) await decryptContent(chatId, "WARMUP", user.user_id);
            const groupKey = groupKeysCache.current[chatId];
            if (groupKey) { content = await encryptMessage(text, groupKey); type = 'encrypted'; }
            else return; 
        }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const optimisticMsg: Message = {
        message_id: tempId,
        chat_id: chatId,
        sender_id: user.user_id,
        message: content,
        type: type,
        timestamp: timestamp,
        status: 'pending',
        replyTo: replyTo
    };

    // Optimistic Update: UI + DB
    setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId]||[]), optimisticMsg] }));
    await databaseService.saveMessage(optimisticMsg);

    const queuePayload = {
        id: tempId,
        chatId,
        senderId: user.user_id,
        content,
        type,
        replyTo,
        timestamp: Date.now()
    };

    if (!navigator.onLine) {
        // Add to SQLite Queue
        await databaseService.addToQueue("SEND_MESSAGE", queuePayload);
        // Add to local state queue for UI reflection if needed
        setQueue(prev => [...prev, queuePayload as any]);
        return;
    }

    try {
        await chatService.sendMessage(chatId, user.user_id, content, type, replyTo, tempId);
        
        // --- TRIGGER PUSH NOTIFICATION ---
        if (chat) {
            // Determine recipients
            const recipients = chat.participants.filter(pid => pid !== user.user_id);
            // In a real scenario, you might loop or send a batch request
            recipients.forEach(pid => {
                notificationService.triggerNotification(
                    pid, 
                    chatId, 
                    user.username, 
                    type === 'encrypted'
                );
            });
        }

    } catch (e) {
        await databaseService.addToQueue("SEND_MESSAGE", queuePayload);
        setQueue(prev => [...prev, queuePayload as any]);
    }
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

  const sendAudio = async (chatId: string, blob: Blob) => {
    if (!user) return;
    try {
        const downloadUrl = await chatService.uploadAudio(chatId, blob);
        await chatService.sendMessage(chatId, user.user_id, downloadUrl, 'audio');
    } catch (e) {
        console.error("Failed to send audio", e);
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
      await databaseService.deleteChats(chatIds);
  };

  const deleteMessages = async (chatId: string, messageIds: string[]) => {
      await chatService.deleteMessages(chatId, messageIds);
      await databaseService.deleteMessages(messageIds);
  };

  const retryFailedMessages = () => processQueue();
  
  const refreshChats = async () => {};

  // --- GROUP MANAGEMENT ---

  const updateGroupInfo = async (chatId: string, name?: string, imageFile?: File) => {
      let imageUrl = undefined;
      if (imageFile) {
          imageUrl = await chatService.uploadImage(chatId, imageFile);
      }
      await chatService.updateChatInfo(chatId, name, imageUrl);
  };

  const addGroupMember = async (chatId: string, newUserId: string) => {
      if (!user) return;
      const chat = chats.find(c => c.chat_id === chatId);
      if (!chat || chat.type !== 'group' || !chat.encrypted_keys) return;

      if (!groupKeysCache.current[chatId]) {
          await decryptContent(chatId, "WARMUP", user.user_id);
      }
      const groupKey = groupKeysCache.current[chatId];
      if (!groupKey) throw new Error("Could not decrypt group key to share");
      
      const groupKeyStr = await exportKeyToString(groupKey);

      const userDocRef = doc(db, 'users', newUserId);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) throw new Error("User not found");
      const newUser = userSnap.data() as User;
      if (!newUser.publicKey) throw new Error("User has no keys setup");

      const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);
      if (!myPrivKeyStr) throw new Error("Private Key Missing");
      
      const sharedSecret = await deriveSharedKey(myPrivKeyStr, newUser.publicKey);
      const newEncryptedKey = await encryptMessage(groupKeyStr, sharedSecret);

      await chatService.addGroupParticipant(chatId, newUserId, newEncryptedKey);
  };

  const removeGroupMember = async (chatId: string, userIdToRemove: string) => {
      if (!user) return;
      const chat = chats.find(c => c.chat_id === chatId);
      if (!chat || chat.type !== 'group') return;

      const newGroupKey = await generateSymmetricKey();
      const newGroupKeyStr = await exportKeyToString(newGroupKey);

      const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);
      if (!myPrivKeyStr) throw new Error("Private Key Missing");

      const remainingParticipants = chat.participants.filter(p => p !== userIdToRemove);
      const newEncryptedKeys: Record<string, string> = {};

      for (const pId of remainingParticipants) {
           let pUser = contacts.find(c => c.user_id === pId);
           if (pId === user.user_id) pUser = user;

           if (!pUser && pId !== user.user_id) {
               const docRef = doc(db, 'users', pId);
               const snap = await getDoc(docRef);
               if (snap.exists()) pUser = snap.data() as User;
           }

           if (pUser?.publicKey) {
               const shared = await deriveSharedKey(myPrivKeyStr, pUser.publicKey);
               const encryptedKey = await encryptMessage(newGroupKeyStr, shared);
               newEncryptedKeys[pId] = encryptedKey;
           }
      }

      await chatService.removeGroupParticipant(chatId, userIdToRemove, user.user_id, newEncryptedKeys);

      groupKeysCache.current[chatId] = newGroupKey;
  };

  // --- BLOCKING ---

  const blockUser = async (targetUserId: string) => {
      if(!user) return;
      await chatService.blockUser(user.user_id, targetUserId);
  };

  const unblockUser = async (targetUserId: string) => {
      if(!user) return;
      await chatService.unblockUser(user.user_id, targetUserId);
  };

  // --- WALLPAPER ---

  const setWallpaper = async (chatId: string, wallpaper: Wallpaper | null, isGroupShared: boolean) => {
      if (!user) return;
      if (isGroupShared) {
          await chatService.setGroupWallpaper(chatId, wallpaper);
      } else {
          await chatService.setPersonalWallpaper(user.user_id, chatId, wallpaper);
      }
  };

  const uploadWallpaper = async (file: File): Promise<string> => {
      return chatService.uploadWallpaperImage(file);
  };

  return (
    <DataContext.Provider value={{ 
        chats, messages, callHistory, settings, syncing, isOffline, contacts, typingStatus,
        refreshChats, loadMessages, loadMoreMessages, sendMessage, sendImage, sendAudio, retryFailedMessages, 
        createChat, loadContacts, markChatAsRead, decryptContent, toggleReaction, setTyping,
        deleteChats, deleteMessages, getMessage,
        updateGroupInfo, addGroupMember, removeGroupMember,
        blockUser, unblockUser,
        setWallpaper, uploadWallpaper
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