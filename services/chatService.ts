
import { User, Chat, Message, AppSettings, ApiResponse, LogEvent } from '../types';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    limit, 
    addDoc, 
    updateDoc, 
    onSnapshot,
    writeBatch,
    arrayRemove
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
      
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        // Ensure enable_groups exists for legacy users
        if (userData.enable_groups === undefined) {
            userData.enable_groups = true;
        }
        return success({ ...userData, status: 'online' });
      } else {
         // Create default profile if missing
         const newUser: User = {
            user_id: uid,
            username: userCredential.user.displayName || email.split('@')[0],
            email: userCredential.user.email || email,
            status: 'online',
            last_seen: new Date().toISOString(),
            is_blocked: false,
            enable_groups: true
         };
         await setDoc(userDocRef, newUser);
         return success(newUser);
      }
    } catch (e: any) {
      console.error("[ChatService] Login failed:", e);
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
          is_blocked: false,
          enable_groups: true
      };

      await setDoc(doc(db, 'users', uid), newUser);
      await updateProfile(userCredential.user, { displayName: username });
      
      return success(newUser);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  updateUserPublicKey: async (userId: string, publicKey: string) => {
      try {
          await updateDoc(doc(db, 'users', userId), { publicKey });
      } catch (e) {
          console.error("Failed to update public key", e);
      }
  },

  updateUserKeys: async (userId: string, publicKey: string, privateKey: string) => {
      try {
          await updateDoc(doc(db, 'users', userId), { 
              publicKey,
              privateKey
          });
      } catch (e) {
          console.error("Failed to update user keys", e);
      }
  },

  updateUserProfile: async (userId: string, data: Partial<User>) => {
      try {
          await updateDoc(doc(db, 'users', userId), data);
          if (data.username && auth.currentUser) {
              await updateProfile(auth.currentUser, { displayName: data.username });
          }
      } catch (e) {
          console.error("Failed to update profile", e);
          throw e;
      }
  },

  updateHeartbeat: async (userId: string) => {
      try {
          await updateDoc(doc(db, 'users', userId), {
              last_seen: new Date().toISOString(),
              status: 'online'
          });
      } catch (e) {
          // Ignore network errors for heartbeat
      }
  },

  setUserOffline: async (userId: string) => {
      try {
          await updateDoc(doc(db, 'users', userId), {
              status: 'offline',
              last_seen: new Date().toISOString()
          });
      } catch (e) {
          console.error("Failed to set offline", e);
      }
  },

  // --- CONTACTS ---

  fetchContacts: async (currentUserId: string): Promise<ApiResponse<User[]>> => {
    try {
      const q = query(collection(db, 'users'), limit(100));
      const snapshot = await getDocs(q);
      
      const users: User[] = [];
      snapshot.forEach(doc => {
          if (doc.id !== currentUserId) {
            users.push({ ...doc.data(), user_id: doc.id } as User);
          }
      });
      
      users.sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
          return a.username.localeCompare(b.username);
      });
      
      return success(users);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  subscribeToUsers: (currentUserId: string, callback: (users: User[]) => void) => {
      const q = query(collection(db, 'users'), limit(100));
      return onSnapshot(q, (snapshot) => {
          const users: User[] = [];
          snapshot.forEach(doc => {
              if (doc.id !== currentUserId) {
                  const data = doc.data();
                  if (data) {
                      users.push({ 
                          ...data, 
                          user_id: doc.id,
                          last_seen: data.last_seen || new Date(0).toISOString(),
                          status: data.status || 'offline'
                      } as User);
                  }
              }
          });
          callback(users);
      });
  },

  // --- CHATS ---

  createChat: async (userId: string, participants: string[], groupName?: string): Promise<ApiResponse<Chat>> => {
    try {
      // If 1-on-1 and no group name forced, check for existing
      if (participants.length === 2 && !groupName) {
          const q = query(
              collection(db, 'chats'), 
              where('participants', 'array-contains', userId)
          );
          const snapshot = await getDocs(q);
          const existing = snapshot.docs.find(doc => {
             const data = doc.data();
             return data.participants.length === 2 && data.participants.includes(participants.find(p => p !== userId));
          });
          if (existing) return success({ ...existing.data(), chat_id: existing.id } as Chat);
      }

      const isGroup = participants.length > 2 || !!groupName;

      const newChatData = {
          type: isGroup ? 'group' : 'private',
          participants,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          name: groupName || (isGroup ? 'Group Chat' : '')
      };

      const docRef = await addDoc(collection(db, 'chats'), newChatData);
      return success({ ...newChatData, chat_id: docRef.id } as Chat);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  subscribeToChats: (userId: string, callback: (chats: Chat[]) => void) => {
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
      return onSnapshot(q, (snapshot) => {
          const chats = snapshot.docs.map(doc => ({ chat_id: doc.id, ...doc.data() } as Chat));
          chats.sort((a, b) => {
              const tA = new Date(a.updated_at || a.created_at || 0).getTime();
              const tB = new Date(b.updated_at || b.created_at || 0).getTime();
              return tB - tA;
          });
          callback(chats);
      });
  },

  deleteChats: async (userId: string, chatIds: string[]) => {
      if (chatIds.length === 0) return;
      try {
          const batch = writeBatch(db);
          chatIds.forEach(id => {
              const ref = doc(db, 'chats', id);
              // Instead of hard deleting, remove the user from participants.
              // If participants become empty, one could technically delete the doc, 
              // but Firestore rules usually handle cleanup or we leave it.
              batch.update(ref, {
                  participants: arrayRemove(userId)
              });
          });
          await batch.commit();
      } catch (e) {
          console.error("Failed to delete chats", e);
      }
  },

  // --- MESSAGES ---

  subscribeToMessages: (chatId: string, limitCount: number, callback: (msgs: Message[]) => void) => {
      const qLimited = query(
          collection(db, `chats/${chatId}/messages`),
          limit(100) 
      );
      return onSnapshot(qLimited, { includeMetadataChanges: true }, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({
              message_id: doc.id,
              ...doc.data(),
              status: doc.metadata.hasPendingWrites ? 'pending' : doc.data().status
          } as Message));
          
          msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          callback(msgs);
      });
  },

  // Client-side compression to Base64 to avoid Firebase Storage (Free Solution)
  uploadImage: async (chatId: string, file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (e) => {
              const img = new Image();
              img.src = e.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  
                  // Constraint: Firestore documents have a 1MB size limit.
                  // We resize images to max 800px to ensure the Base64 string fits easily.
                  const MAX_WIDTH = 800;
                  const MAX_HEIGHT = 800;

                  if (width > height) {
                      if (width > MAX_WIDTH) {
                          height *= MAX_WIDTH / width;
                          width = MAX_WIDTH;
                      }
                  } else {
                      if (height > MAX_HEIGHT) {
                          width *= MAX_HEIGHT / height;
                          height = MAX_HEIGHT;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // Compress to JPEG with 0.5 quality
                  // This typically yields a string size of ~50-100KB
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
                  resolve(dataUrl);
              };
              img.onerror = (err) => reject(new Error("Failed to load image"));
          };
          reader.onerror = (err) => reject(new Error("Failed to read file"));
      });
  },

  sendMessage: async (
      chatId: string, 
      senderId: string, 
      content: string, 
      type: 'text' | 'encrypted' | 'image' = 'text',
      replyTo?: Message['replyTo']
  ): Promise<ApiResponse<Message>> => {
    try {
      const timestamp = new Date().toISOString();
      const msgData: any = {
          chat_id: chatId,
          sender_id: senderId,
          message: content, // For type='image', this is the Base64 string
          type: type,
          timestamp: timestamp,
          status: 'sent'
      };

      if (replyTo) {
          msgData.replyTo = replyTo;
      }

      const msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
      
      // Update Chat Metadata (last_message)
      updateDoc(doc(db, 'chats', chatId), {
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
        messageIds.forEach(id => {
            const ref = doc(db, `chats/${chatId}/messages`, id);
            batch.update(ref, { status: status });
        });

        // Also update the chat last_message if relevant
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            if (chatData.last_message && messageIds.includes(chatData.last_message.message_id)) {
                 batch.update(chatRef, { "last_message.status": status });
            }
        }

        await batch.commit();
      } catch (e) {
          console.error("Failed to update message status", e);
      }
  },

  markChatDelivered: async (chatId: string, userId: string) => {
    try {
      const q = query(
        collection(db, `chats/${chatId}/messages`),
        where('status', '==', 'sent')
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const lastMsgId = chatSnap.exists() ? chatSnap.data()?.last_message?.message_id : null;
      let updateChatLastMessage = false;
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        if (docSnap.data().sender_id === userId) return;

        batch.update(docSnap.ref, { status: 'delivered' });
        if (lastMsgId === docSnap.id) updateChatLastMessage = true;
        count++;
      });
      
      if (count === 0) return;

      if (updateChatLastMessage) {
        batch.update(chatRef, { 'last_message.status': 'delivered' });
      }

      await batch.commit();
    } catch (e) {
      console.error("markChatDelivered failed", e);
    }
  },

  markChatRead: async (chatId: string, userId: string) => {
    try {
      const q = query(
        collection(db, `chats/${chatId}/messages`),
        where('status', 'in', ['sent', 'delivered'])
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const lastMsgId = chatSnap.exists() ? chatSnap.data()?.last_message?.message_id : null;
      let updateChatLastMessage = false;
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        if (docSnap.data().sender_id === userId) return;

        batch.update(docSnap.ref, { status: 'read' });
        if (lastMsgId === docSnap.id) updateChatLastMessage = true;
        count++;
      });
      
      if (count === 0) return;

      if (updateChatLastMessage) {
        batch.update(chatRef, { 'last_message.status': 'read' });
      }

      await batch.commit();
    } catch (e) {
      console.error("markChatRead failed", e);
    }
  },

  deleteMessages: async (chatId: string, messageIds: string[]) => {
      if (messageIds.length === 0) return;
      try {
          const batch = writeBatch(db);
          messageIds.forEach(id => {
              const ref = doc(db, `chats/${chatId}/messages`, id);
              batch.delete(ref);
          });
          await batch.commit();
      } catch (e) {
          console.error("Failed to delete messages", e);
      }
  },
  
  markAs: async (chatId: string, messageId: string, status: 'delivered' | 'read') => {
      try {
          // Update the message document
          await updateDoc(doc(db, `chats/${chatId}/messages`, messageId), { status });
          
          // Check and update chat last_message if it matches
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
              const chatData = chatSnap.data();
              if (chatData.last_message && chatData.last_message.message_id === messageId) {
                  await updateDoc(chatRef, { "last_message.status": status });
              }
          }
      } catch (e) {
        console.error("MarkAs failed", e);
      }
  },

  fetchSettings: async (): Promise<ApiResponse<AppSettings>> => {
      return success( { max_message_length: 1000, enable_groups: true, maintenance_mode: false, announcement: "" });
  },

  logEvent: async (event: LogEvent) => {}
};
