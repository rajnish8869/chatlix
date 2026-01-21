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
    writeBatch
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
    console.log("[ChatService] Login called for:", email);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      console.log("[ChatService] Auth successful. UID:", uid);
      
      try {
        const userDocRef = doc(db, 'users', uid);
        console.log("[ChatService] Fetching user profile from Firestore...");
        
        // This might fail if offline and not cached
        const userDoc = await getDoc(userDocRef);
        console.log("[ChatService] Profile fetch result - Exists:", userDoc.exists());
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          
          // NON-BLOCKING: Update status to online in background
          console.log("[ChatService] Triggering background online status update");
          updateDoc(userDocRef, {
              status: 'online',
              last_seen: new Date().toISOString()
          }).catch(err => console.warn("[ChatService] Background status update failed:", err));

          return success({ ...userData, status: 'online' });
        } else {
            // Self-healing: Create default profile if missing
            console.warn("[ChatService] User profile missing in Firestore, creating default profile...");
            const newUser: User = {
                user_id: uid,
                username: userCredential.user.displayName || email.split('@')[0],
                email: userCredential.user.email || email,
                status: 'online',
                last_seen: new Date().toISOString(),
                is_blocked: false
            };
            // NON-BLOCKING: Create doc in background
            setDoc(userDocRef, newUser).catch(err => console.warn("[ChatService] Background profile creation failed:", err));
            
            return success(newUser);
        }
      } catch (docError: any) {
        console.warn("[ChatService] Failed to fetch/create user profile doc, using auth data. Error:", docError.code || docError.message);
        
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
      console.error("[ChatService] Login failed:", e);
      return fail(e.message);
    }
  },

  signup: async (username: string, email: string, password: string): Promise<ApiResponse<User>> => {
    console.log("[ChatService] Signup called for:", username, email);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      console.log("[ChatService] Auth created. UID:", uid);
      
      const newUser: User = {
          user_id: uid,
          username,
          email,
          status: 'online',
          last_seen: new Date().toISOString(),
          is_blocked: false
      };

      // NON-BLOCKING: Write to Firestore in background. 
      console.log("[ChatService] Triggering background profile creation");
      setDoc(doc(db, 'users', uid), newUser).catch(e => console.error("[ChatService] Profile creation error:", e));
      
      // Update Auth profile (usually fast)
      await updateProfile(userCredential.user, { displayName: username });
      
      return success(newUser);
    } catch (e: any) {
      console.error("[ChatService] Signup failed:", e);
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
          const data = doc.data() as User;
          if (doc.id !== currentUserId) {
            // Ensure user_id matches doc.id
            users.push({ ...data, user_id: doc.id });
          }
      });
      return success(users);
    } catch (e: any) {
      // Fallback if index is missing or orderBy fails
      try {
          const q = query(collection(db, 'users'), limit(50));
          const snapshot = await getDocs(q);
          const users: User[] = [];
          snapshot.forEach(doc => {
            if (doc.id !== currentUserId) {
                const data = doc.data() as User;
                users.push({ ...data, user_id: doc.id });
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
      // FIX: Removed orderBy('updated_at', 'desc') to avoid needing a composite index.
      // We query only by participants and sort client-side.
      const q = query(
          collection(db, 'chats'), 
          where('participants', 'array-contains', userId)
      );
      
      return onSnapshot(q, (snapshot) => {
          const chats = snapshot.docs.map(doc => ({
              chat_id: doc.id,
              ...doc.data()
          } as Chat));
          
          // Client-side sorting (Newest first)
          chats.sort((a, b) => {
              const tA = new Date(a.updated_at || a.created_at || 0).getTime();
              const tB = new Date(b.updated_at || b.created_at || 0).getTime();
              return tB - tA;
          });

          callback(chats);
      }, (error) => {
          console.error("Error subscribing to chats:", error);
          if (error.code === 'permission-denied') {
              console.warn("Check Firestore Rules. Users must be allowed to read chats they are participants of.");
          }
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
          status: 'sent'
      };

      // 1. Add Message
      const msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
      
      // 2. Update Chat Metadata (last_message)
      const chatRef = doc(db, 'chats', chatId);
      // NON-BLOCKING: Update chat metadata in background
      updateDoc(chatRef, {
          last_message: { ...msgData, message_id: msgRef.id },
          updated_at: timestamp
      }).catch(e => console.warn("Failed to update chat metadata", e));

      return success({ ...msgData, message_id: msgRef.id } as Message);
    } catch (e: any) {
      return fail(e.message);
    }
  },
    
  updateMessageStatus: async (chatId: string, messageIds: string[], status: 'delivered' | 'read') => {
      if (messageIds.length === 0) return;

      try {
        const batch = writeBatch(db);
        
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