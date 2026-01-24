

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User, ApiResponse } from '../types';
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
import { db } from '../services/firebase'; 

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
}

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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [rawFirestoreUsers, setRawFirestoreUsers] = useState<User[]>([]);
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, any>>({});

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
  const contactsUnsub = useRef<UnsubscribeFunc | null>(null);
  const presenceUnsub = useRef<UnsubscribeFunc | null>(null);
  const messageUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  const typingUnsubs = useRef<Record<string, UnsubscribeFunc>>({});
  
  const sharedKeysCache = useRef<Record<string, { key: CryptoKey, pubKeyStr: string }>>({});
  const groupKeysCache = useRef<Record<string, CryptoKey>>({});

  // 1. Load Queue from Storage
  useEffect(() => {
      const savedQueue = localStorage.getItem('chatlix_offline_queue');
      if (savedQueue) {
          try {
              setQueue(JSON.parse(savedQueue));
          } catch (e) {
              console.error("Failed to parse offline queue", e);
          }
      }
  }, []);

  // 2. Persist Queue to Storage
  useEffect(() => {
      localStorage.setItem('chatlix_offline_queue', JSON.stringify(queue));
  }, [queue]);

  const processQueue = useCallback(async () => {
      if (queue.length === 0 || !navigator.onLine) return;
      
      const currentQueue = [...queue];
      const remainingQueue: QueueItem[] = [];

      for (const item of currentQueue) {
          try {
              // Idempotent Send
              await chatService.sendMessage(
                  item.chatId,
                  item.senderId,
                  item.content,
                  item.type,
                  item.replyTo,
                  item.id
              );
          } catch (e) {
              remainingQueue.push(item);
          }
      }

      setQueue(remainingQueue);
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

  // Sync Typing Listeners with Chats
  useEffect(() => {
      chats.forEach(chat => {
          if (!typingUnsubs.current[chat.chat_id]) {
              typingUnsubs.current[chat.chat_id] = chatService.subscribeToChatTyping(chat.chat_id, (userIds) => {
                  // FILTERING: Remove blocked users from typing status
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
        setContacts([]);
        setRawFirestoreUsers([]);
        setRtdbPresence({});
        setTypingStatusState({});
        groupKeysCache.current = {};
        if (chatsUnsub.current) chatsUnsub.current();
        if (contactsUnsub.current) contactsUnsub.current();
        if (presenceUnsub.current) presenceUnsub.current();
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
                 // Don't mark delivered if blocked
                 if (!user.blocked_users?.includes(chat.last_message.sender_id)) {
                    chatService.markChatDelivered(chat.chat_id, user.user_id);
                 }
            }
        });
    }) as UnsubscribeFunc;

    // 2. Subscribe to Users
    contactsUnsub.current = chatService.subscribeToUsers(user.user_id, (users) => {
        setRawFirestoreUsers(users);
    }) as UnsubscribeFunc;

    // 3. Subscribe to Global Presence
    presenceUnsub.current = chatService.subscribeToGlobalPresence((presenceMap) => {
        setRtdbPresence(presenceMap);
    }) as unknown as UnsubscribeFunc;

    if (chatService.fetchSettings) {
        chatService.fetchSettings().then(res => {
            if(res.success && res.data) setSettings(res.data);
        });
    }

    // Force refresh message listeners if blocked list changes
    Object.keys(messageUnsubs.current).forEach(chatId => {
        const unsub = messageUnsubs.current[chatId];
        if (typeof unsub === 'function') unsub();
        delete messageUnsubs.current[chatId];
        loadMessages(chatId);
    });

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
              try {
                 const raw = rawFirestoreUsers.find(u => u.user_id === otherUserId);
                 if (raw && raw.publicKey) {
                     targetPubKey = raw.publicKey;
                 } else {
                     const userDocRef = doc(db, 'users', otherUserId);
                     const userSnap = await getDoc(userDocRef);
                     if (userSnap.exists()) {
                         const userData = userSnap.data() as User;
                         targetPubKey = userData.publicKey || '';
                     }
                 }
              } catch (e) {
                  console.error(`Failed to fetch key for ${otherUserId}`, e);
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
        const groupKey = await generateSymmetricKey();
        const groupKeyStr = await exportKeyToString(groupKey);

        encryptedKeysPayload = {};
        const myPrivKeyStr = await SecureStorage.get(`chatlix_priv_${user.user_id}`);

        if (!myPrivKeyStr) {
            console.error("Cannot create encrypted group: Missing private key");
            return null;
        }
        
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
    if (messageUnsubs.current[chatId]) return;

    messageUnsubs.current[chatId] = chatService.subscribeToMessages(chatId, 50, (incomingMsgs) => {
        // FILTERING: Remove messages from blocked users
        const blocked = user?.blocked_users || [];
        const filteredMsgs = incomingMsgs.filter(m => !blocked.includes(m.sender_id));

        setMessages(prev => {
            const currentMsgs = prev[chatId] || [];
            const msgMap = new Map();
            currentMsgs.forEach(m => msgMap.set(m.message_id, m));
            filteredMsgs.forEach(m => msgMap.set(m.message_id, m));
            
            // Remove any messages that are now blocked (in case they were in state)
            for (const [id, m] of msgMap.entries()) {
                if (blocked.includes(m.sender_id)) {
                    msgMap.delete(id);
                }
            }

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
              // FILTERING: Remove blocked users from history
              const blocked = user?.blocked_users || [];
              const historyMsgs = res.data.filter(m => !blocked.includes(m.sender_id));

              setMessages(prev => {
                  const current = prev[chatId] || [];
                  const msgMap = new Map();
                  historyMsgs.forEach(m => msgMap.set(m.message_id, m));
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

  const getMessage = async (chatId: string, messageId: string) => {
      return chatService.getMessage(chatId, messageId);
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
            } else if (chat.participants.length === 1 && chat.participants[0] === user.user_id) {
                const key = await getSharedKey(user.user_id);
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
            } else {
                console.error("Cannot send message: Group key unavailable");
                return;
            }
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

    setMessages(prev => {
        const current = prev[chatId] || [];
        return { ...prev, [chatId]: [...current, optimisticMsg] };
    });

    const addToQueue = () => {
        const queueItem: QueueItem = {
            id: tempId,
            chatId,
            senderId: user.user_id,
            content,
            type,
            replyTo,
            timestamp: Date.now()
        };
        setQueue(prev => [...prev, queueItem]);
    };

    if (!navigator.onLine) {
        addToQueue();
        return;
    }

    try {
        await chatService.sendMessage(chatId, user.user_id, content, type, replyTo, tempId);
    } catch (e) {
        console.error("SendMessage failed, adding to queue", e);
        addToQueue();
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
  };

  const deleteMessages = async (chatId: string, messageIds: string[]) => {
      await chatService.deleteMessages(chatId, messageIds);
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

  return (
    <DataContext.Provider value={{ 
        chats, messages, settings, syncing, isOffline, contacts, typingStatus,
        refreshChats, loadMessages, loadMoreMessages, sendMessage, sendImage, sendAudio, retryFailedMessages, 
        createChat, loadContacts, markChatAsRead, decryptContent, toggleReaction, setTyping,
        deleteChats, deleteMessages, getMessage,
        updateGroupInfo, addGroupMember, removeGroupMember,
        blockUser, unblockUser
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
