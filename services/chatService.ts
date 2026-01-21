import { User, Chat, Message, AppSettings, ApiResponse, LogEvent } from '../types';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit, 
    addDoc, 
    updateDoc, 
    onSnapshot
} from 'firebase/firestore';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from 'firebase/auth';
import { auth, db } from './firebase';

// Helper to standardise responses
const success = <T>(data?: T): ApiResponse<T> => ({ success: true, data });
const fail = <T>(error: string): ApiResponse<T> => ({ success: false, error });

export const chatService = {
  
  // --- AUTH ---
  
  login: async (email: string, password: string): Promise<ApiResponse<User>> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          // Update status to online on login
          await updateDoc(doc(db, 'users', userCredential.user.uid), {
              status: 'online',
              last_seen: new Date().toISOString()
          });
          return success({ ...userData, status: 'online' });
        }
      } catch (docError) {
        console.warn("Failed to fetch user profile doc, using auth data", docError);
        const fallbackUser: User = {
            user_id: userCredential.user.uid,
            username: userCredential.user.displayName || 'User',
            email: userCredential.user.email || '',
            status: 'online',
            last_seen: new Date().toISOString(),
            is_blocked: false
        };
        return success(fallbackUser);
      }
      
      return fail('User profile not found.');
    } catch (e: any) {
      return fail(e.message);
    }
  },

  signup: async (username: string, email: string, password: string): Promise<ApiResponse<User>> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      const newUser: User = {
          user_id: uid,
          username,
          email,
          status: 'online',
          last_seen: new Date().toISOString(),
          is_blocked: false
      };

      await setDoc(doc(db, 'users', uid), newUser);
      await updateProfile(userCredential.user, { displayName: username });
      
      return success(newUser);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  // --- CONTACTS ---

  fetchContacts: async (currentUserId: string): Promise<ApiResponse<User[]>> => {
    try {
      const q = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(q);
      const users: User[] = [];
      snapshot.forEach(doc => {
          if (doc.id !== currentUserId) {
            users.push(doc.data() as User);
          }
      });
      return success(users);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  // --- CHATS ---

  createChat: async (userId: string, participants: string[]): Promise<ApiResponse<Chat>> => {
    try {
      // Check for existing 1-on-1 chat
      if (participants.length === 2) {
          const q = query(
              collection(db, 'chats'), 
              where('participants', 'array-contains', userId)
          );
          const snapshot = await getDocs(q);
          const existing = snapshot.docs.find(doc => {
             const data = doc.data();
             return data.participants.length === 2 && data.participants.includes(participants.find(p => p !== userId));
          });
          
          if (existing) {
              return success({ ...existing.data(), chat_id: existing.id } as Chat);
          }
      }

      const newChatData = {
          type: participants.length > 2 ? 'group' : 'private',
          participants,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          name: participants.length > 2 ? 'New Group' : ''
      };

      const docRef = await addDoc(collection(db, 'chats'), newChatData);
      return success({ ...newChatData, chat_id: docRef.id } as Chat);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  subscribeToChats: (userId: string, callback: (chats: Chat[]) => void) => {
      // Requires Firestore Index: chats -> participants (array-contains) + updated_at (desc)
      const q = query(
          collection(db, 'chats'), 
          where('participants', 'array-contains', userId),
          orderBy('updated_at', 'desc')
      );
      
      return onSnapshot(q, (snapshot) => {
          const chats = snapshot.docs.map(doc => ({
              chat_id: doc.id,
              ...doc.data()
          } as Chat));
          callback(chats);
      }, (error) => {
          console.error("Error subscribing to chats. ensure composite index exists:", error);
      });
  },

  fetchChats: async (userId: string): Promise<ApiResponse<Chat[]>> => {
      return success([]);
  },
  
  // --- MESSAGES ---

  subscribeToMessages: (chatId: string, limitCount: number, callback: (msgs: Message[]) => void) => {
      const qLimited = query(
          collection(db, `chats/${chatId}/messages`),
          orderBy('timestamp', 'asc')
      );

      return onSnapshot(qLimited, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({
              message_id: doc.id,
              ...doc.data()
          } as Message));
          callback(msgs);
      });
  },

  sendMessage: async (chatId: string, senderId: string, text: string, tempId?: string): Promise<ApiResponse<Message>> => {
    try {
      const timestamp = new Date().toISOString();
      const msgData = {
          chat_id: chatId,
          sender_id: senderId,
          message: text,
          type: 'text',
          timestamp: timestamp,
          status: 'sent'
      };

      // 1. Add Message
      const msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
      
      // 2. Update Chat Metadata (last_message)
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
          last_message: { ...msgData, message_id: msgRef.id },
          updated_at: timestamp
      });

      return success({ ...msgData, message_id: msgRef.id } as Message);
    } catch (e: any) {
      return fail(e.message);
    }
  },
    
  updateMessageStatus: async (chatId: string, messageIds: string[], status: 'delivered' | 'read') => {
      // In a real production app, use batch writes
      try {
        // Placeholder for batch update logic
        // messageIds.forEach(id => updateDoc(doc(db, `chats/${chatId}/messages`, id), { status }));
      } catch (e) {
          console.error(e);
      }
  },

  fetchSettings: async (): Promise<ApiResponse<AppSettings>> => {
      try {
        const docRef = doc(db, 'system', 'settings');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return success(snap.data() as AppSettings);
        }
      } catch (e) {
         // Silently fail to defaults if collection doesn't exist
      }
      return success({
          max_message_length: 1000,
          enable_groups: true,
          maintenance_mode: false,
          announcement: ""
      });
  },

  logEvent: async (event: LogEvent) => {
      // Optional: Log to a 'logs' collection
  }
};