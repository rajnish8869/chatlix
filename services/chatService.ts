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
    onSnapshot,
    writeBatch,
    serverTimestamp
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
      const uid = userCredential.user.uid;
      
      try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          // Update status to online on login
          await updateDoc(userDocRef, {
              status: 'online',
              last_seen: new Date().toISOString()
          });
          return success({ ...userData, status: 'online' });
        } else {
            // Self-healing: If Auth exists but Firestore doc is missing, create it.
            // This prevents "invisible" users who can login but don't show up in contacts.
            console.warn("User profile missing in Firestore, creating default profile...");
            const newUser: User = {
                user_id: uid,
                username: userCredential.user.displayName || email.split('@')[0],
                email: userCredential.user.email || email,
                status: 'online',
                last_seen: new Date().toISOString(),
                is_blocked: false
            };
            await setDoc(userDocRef, newUser);
            return success(newUser);
        }
      } catch (docError) {
        console.warn("Failed to fetch/create user profile doc, using auth data", docError);
        // Fallback for offline or error scenarios
        const fallbackUser: User = {
            user_id: uid,
            username: userCredential.user.displayName || 'User',
            email: userCredential.user.email || '',
            status: 'online',
            last_seen: new Date().toISOString(),
            is_blocked: false
        };
        return success(fallbackUser);
      }
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
      // Order by username for better UX
      const q = query(collection(db, 'users'), orderBy('username'), limit(50));
      const snapshot = await getDocs(q);
      const users: User[] = [];
      snapshot.forEach(doc => {
          // Ensure we don't include ourselves and valid data exists
          const data = doc.data() as User;
          if (doc.id !== currentUserId && data.username) {
            users.push(data);
          }
      });
      return success(users);
    } catch (e: any) {
      // Fallback if index is missing (orderBy usually requires one if mixed with other filters)
      // Retry without ordering
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
      } catch (retryErr: any) {
          return fail(retryErr.message);
      }
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
      // Limit to last 100 messages for performance
      const qLimited = query(
          collection(db, `chats/${chatId}/messages`),
          orderBy('timestamp', 'asc'),
          limit(100) 
      );

      // includeMetadataChanges: true is CRITICAL for offline support. 
      return onSnapshot(qLimited, { includeMetadataChanges: true }, (snapshot) => {
          const msgs = snapshot.docs.map(doc => {
              const data = doc.data();
              // Determine status based on metadata and data
              let status = data.status;
              if (doc.metadata.hasPendingWrites) {
                  status = 'pending';
              }
              
              return {
                  message_id: doc.id,
                  ...data,
                  status: status
              } as Message;
          });
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
          status: 'sent' // Initially sent, subscriber will see 'pending' if offline
      };

      // 1. Add Message
      const msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
      
      // 2. Update Chat Metadata (last_message)
      const chatRef = doc(db, 'chats', chatId);
      // updateDoc resolves when written to backend (or offline cache). 
      // We don't await this strictly for the UI to update, as the listener handles it.
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
      if (messageIds.length === 0) return;

      try {
        const batch = writeBatch(db);
        
        // Firestore limits batches to 500 operations. 
        // We assume messageIds chunk is smaller for this UI interaction.
        messageIds.forEach(id => {
            const ref = doc(db, `chats/${chatId}/messages`, id);
            batch.update(ref, { status: status });
        });

        await batch.commit();
      } catch (e) {
          console.error("Failed to batch update message status", e);
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