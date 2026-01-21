import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, AppSettings, User } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { 
    collection, query, where, orderBy, onSnapshot, 
    addDoc, setDoc, doc, updateDoc, getDocs, limit, serverTimestamp 
} from 'firebase/firestore';
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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [settings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Track active listeners to unsubscribe when needed
  const messageUnsubscribers = useRef<Record<string, () => void>>({});

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
        return;
    }

    setSyncing(true);
    // Listen for chats where user is a participant
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.user_id));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const chatList: Chat[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            chatList.push({
                chat_id: doc.id,
                ...data,
                // Ensure dates are strings for the UI
                created_at: data.created_at || new Date().toISOString(),
                // Last message might be nested, ensure compatibility
                last_message: data.last_message ? {
                    ...data.last_message,
                    timestamp: data.last_message.timestamp || new Date().toISOString()
                } : undefined
            } as Chat);
        });
        
        // Sort by last update locally
        chatList.sort((a, b) => {
            const t1 = a.last_message?.timestamp || a.created_at;
            const t2 = b.last_message?.timestamp || b.created_at;
            return new Date(t2).getTime() - new Date(t1).getTime();
        });

        setChats(chatList);
        setSyncing(false);
    }, (error) => {
        console.error("Chat sync error:", error);
        setSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Functions ---

  const loadContacts = useCallback(async () => {
    if(!user) return;
    // For "Lifetime Free" simple app, fetching all users is acceptable.
    // Ideally use pagination or search index (Algolia/Typesense) for scaling.
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList: User[] = [];
        querySnapshot.forEach((doc) => {
            if (doc.id !== user.user_id) {
                usersList.push(doc.data() as User);
            }
        });
        setContacts(usersList);
    } catch (e) {
        console.error("Error loading contacts", e);
    }
  }, [user]);

  const createChat = async (participants: string[]): Promise<string | null> => {
    if (!user) return null;
    const allParticipants = Array.from(new Set([...participants, user.user_id]));
    
    // Check if 1-on-1 chat exists
    if (allParticipants.length === 2) {
        const otherId = allParticipants.find(id => id !== user.user_id);
        const existing = chats.find(c => c.participants.length === 2 && c.participants.includes(otherId!));
        if (existing) return existing.chat_id;
    }

    try {
        // Resolve names for group name generation
        const names = [];
        if (contacts.length === 0) await loadContacts(); // Ensure we have data
        
        // Quick name generation (Client side for now)
        // In a real app, you might want to fetch user docs here
        
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: Partial<Chat> = {
            chat_id: newChatRef.id,
            type: allParticipants.length > 2 ? 'group' : 'private',
            participants: allParticipants,
            created_at: new Date().toISOString(),
            name: allParticipants.length > 2 ? 'New Group' : '' // Private chats resolve name dynamically in UI
        };
        
        await setDoc(newChatRef, newChat);
        return newChatRef.id;
    } catch (e) {
        console.error("Create chat error", e);
        return null;
    }
  };

  const loadMessages = useCallback(async (chatId: string) => {
    // If already listening, do nothing
    if (messageUnsubscribers.current[chatId]) return;

    // Real-time listener for messages
    const q = query(
        collection(db, 'chats', chatId, 'messages'), 
        orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
            msgs.push({
                ...doc.data(),
                message_id: doc.id
            } as Message);
        });
        
        setMessages(prev => ({ ...prev, [chatId]: msgs }));
    });

    messageUnsubscribers.current[chatId] = unsubscribe;
  }, []);

  const sendMessage = async (chatId: string, text: string) => {
    if (!user || !text.trim()) return;

    const timestamp = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    
    const messageData: Partial<Message> = {
        chat_id: chatId,
        sender_id: user.user_id,
        message: text,
        type: 'text',
        timestamp: timestamp,
        status: 'sent'
    };

    // Optimistic UI (handled by listener usually, but for instant feedback):
    // Firestore listener is fast enough locally to skip manual state push often,
    // but we can do it if needed. Listener handles it.

    try {
        // 1. Add Message
        const msgRef = collection(db, 'chats', chatId, 'messages');
        const docRef = await addDoc(msgRef, messageData);

        // 2. Update Chat Metadata (Last Message)
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
            last_message: { ...messageData, message_id: docRef.id },
            updated_at: timestamp
        });
    } catch (e) {
        console.error("Send failed", e);
        // Error handling would go here (toast etc)
    }
  };

  const markMessagesRead = async (chatId: string, messageIds: string[]) => {
      // In Firestore, marking individual messages read can be write-heavy.
      // Optimization: Update a "read_receipts" map on the chat doc or only update the last message status.
      // For this solution, we will update the messages batch if small, or just ignore for efficiency.
      
      // Let's implement a simple version: update the status of these messages
      // Note: This might be costly on writes if many messages.
      // A better approach for free tier is just updating "last_read_timestamp_by_user" map in chat doc.
      // But preserving existing UI logic:
      
      if (messageIds.length === 0) return;
      
      // We will only update locally for UI and maybe the server if critical
      // Ideally, batch update in Firestore
      // For now, let's just mark the UI as read to avoid spamming the DB in this free-tier optimized version
      setMessages(prev => {
          const list = prev[chatId] || [];
          return {
              ...prev,
              [chatId]: list.map(m => messageIds.includes(m.message_id) ? { ...m, status: 'read' } : m)
          }
      });
  };

  // Stubs for compatibility with UI
  const refreshChats = async () => {};
  const retryFailedMessages = () => {};

  return (
    <DataContext.Provider value={{ 
        chats, 
        messages, 
        settings: { ...settings, maintenance_mode: false }, 
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