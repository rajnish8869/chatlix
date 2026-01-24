

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
    arrayRemove,
    arrayUnion,
    orderBy,
    deleteField
} from 'firebase/firestore';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from 'firebase/auth';
import { 
    ref as dbRef, 
    set, 
    onValue, 
    onDisconnect, 
    remove, 
    serverTimestamp 
} from 'firebase/database';
import { auth, db, rtdb, storage } from './firebase';

// Helper to standardise responses
const success = <T>(data?: T): ApiResponse<T> => ({ success: true, data });
const fail = <T>(error: string): ApiResponse<T> => ({ success: false, error });

// Helper for image compression
const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
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

                  if (width > height) {
                      if (width > maxWidth) {
                          height *= maxWidth / width;
                          width = maxWidth;
                      }
                  } else {
                      if (height > maxHeight) {
                          width *= maxHeight / height;
                          height = maxHeight;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  const dataUrl = canvas.toDataURL('image/jpeg', quality); 
                  resolve(dataUrl);
              };
              img.onerror = (err) => reject(new Error("Failed to load image"));
          };
          reader.onerror = (err) => reject(new Error("Failed to read file"));
      });
};

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
  
  uploadProfilePicture: async (userId: string, file: File): Promise<string> => {
      try {
          // Compress specifically for profile pictures (smaller)
          const dataUrl = await compressImage(file, 500, 500, 0.6);
          await updateDoc(doc(db, 'users', userId), {
              profile_picture: dataUrl
          });
          return dataUrl;
      } catch (e) {
          console.error("Failed to upload profile picture", e);
          throw e;
      }
  },

  // Note: This Firestore update is kept for historical/profile data, 
  // but real-time presence is now handled by initializePresence via RTDB
  updateHeartbeat: async (userId: string) => {
      try {
          await updateDoc(doc(db, 'users', userId), {
              last_seen: new Date().toISOString()
          });
      } catch (e) {
          // Ignore network errors for heartbeat
      }
  },

  setUserOffline: async (userId: string) => {
      try {
          // Remove from RTDB
          const statusRef = dbRef(rtdb, `status/${userId}`);
          await set(statusRef, {
              state: 'offline',
              last_changed: serverTimestamp(),
          });
          
          // Update Firestore for persistence
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
      
      users.sort((a, b) => a.username.localeCompare(b.username));
      
      return success(users);
    } catch (e: any) {
      return fail(e.message);
    }
  },

  // Returns Firestore user profiles. Status is merged in DataContext from RTDB.
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
                          // Default to offline in profile, overriden by RTDB
                          status: 'offline', 
                          last_seen: data.last_seen || new Date(0).toISOString(),
                      } as User);
                  }
              }
          });
          callback(users);
      });
  },

  // --- PRESENCE (RTDB) ---

  initializePresence: (userId: string) => {
      const userStatusDatabaseRef = dbRef(rtdb, `status/${userId}`);
      const connectedRef = dbRef(rtdb, '.info/connected');

      onValue(connectedRef, (snapshot) => {
          if (snapshot.val() === false) {
              return;
          }

          // When we disconnect, remove this device
          onDisconnect(userStatusDatabaseRef).set({
              state: 'offline',
              last_changed: serverTimestamp(),
          }).then(() => {
              // When we connect, set status to online
              set(userStatusDatabaseRef, {
                  state: 'online',
                  last_changed: serverTimestamp(),
              });
          });
      });
  },

  subscribeToGlobalPresence: (callback: (presenceMap: Record<string, any>) => void) => {
      const allStatusRef = dbRef(rtdb, 'status');
      return onValue(allStatusRef, (snapshot) => {
          if (snapshot.exists()) {
              callback(snapshot.val());
          } else {
              callback({});
          }
      });
  },

  // --- CHATS & GROUPS ---

  createChat: async (
      userId: string, 
      participants: string[], 
      groupName?: string, 
      encryptedKeys?: Record<string, string>
    ): Promise<ApiResponse<Chat>> => {
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

      const newChatData: any = {
          type: isGroup ? 'group' : 'private',
          participants,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          name: groupName || (isGroup ? 'Group Chat' : '')
      };

      // Add E2EE payload for groups
      if (isGroup) {
          newChatData.admins = [userId]; // Creator is admin
          if (encryptedKeys) {
             newChatData.key_issuer_id = userId;
             newChatData.encrypted_keys = encryptedKeys;
          }
      }

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
              batch.update(ref, {
                  participants: arrayRemove(userId),
                  admins: arrayRemove(userId)
              });
          });
          await batch.commit();
      } catch (e) {
          console.error("Failed to delete chats", e);
      }
  },

  // --- GROUP MANAGEMENT ---

  updateChatInfo: async (chatId: string, name?: string, image?: string) => {
      try {
          const data: any = { updated_at: new Date().toISOString() };
          if (name) data.name = name;
          if (image) data.group_image = image;
          await updateDoc(doc(db, 'chats', chatId), data);
      } catch (e) {
          console.error("Failed to update chat info", e);
          throw e;
      }
  },

  addGroupParticipant: async (
      chatId: string, 
      newUserId: string, 
      newEncryptedKey: string
  ) => {
      try {
          await updateDoc(doc(db, 'chats', chatId), {
              participants: arrayUnion(newUserId),
              [`encrypted_keys.${newUserId}`]: newEncryptedKey,
              updated_at: new Date().toISOString()
          });
      } catch (e) {
          console.error("Failed to add participant", e);
          throw e;
      }
  },

  // Key Rotation on removal
  removeGroupParticipant: async (
      chatId: string, 
      userIdToRemove: string, 
      newKeyIssuerId: string, 
      newEncryptedKeys: Record<string, string>
  ) => {
      try {
          await updateDoc(doc(db, 'chats', chatId), {
              participants: arrayRemove(userIdToRemove),
              admins: arrayRemove(userIdToRemove),
              key_issuer_id: newKeyIssuerId,
              encrypted_keys: newEncryptedKeys, // Full replacement for rotation
              updated_at: new Date().toISOString()
          });
      } catch (e) {
          console.error("Failed to remove participant", e);
          throw e;
      }
  },

  // --- MESSAGES ---

  subscribeToMessages: (chatId: string, limitCount: number, callback: (msgs: Message[]) => void) => {
      const qRealtime = query(
          collection(db, `chats/${chatId}/messages`),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
      );

      return onSnapshot(qRealtime, { includeMetadataChanges: true }, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({
              message_id: doc.id,
              ...doc.data(),
              status: doc.metadata.hasPendingWrites ? 'pending' : doc.data().status
          } as Message));
          
          msgs.reverse();
          callback(msgs);
      });
  },

  fetchHistory: async (chatId: string, beforeTimestamp: string): Promise<ApiResponse<Message[]>> => {
      try {
          const q = query(
              collection(db, `chats/${chatId}/messages`),
              where('timestamp', '<', beforeTimestamp),
              orderBy('timestamp', 'desc'),
              limit(50)
          );
          
          const snapshot = await getDocs(q);
          const msgs = snapshot.docs.map(doc => ({
              message_id: doc.id,
              ...doc.data(),
              status: 'read'
          } as Message));
          
          return success(msgs.reverse());
      } catch (e: any) {
          return fail(e.message);
      }
  },

  getMessage: async (chatId: string, messageId: string): Promise<ApiResponse<Message>> => {
      try {
          const docRef = doc(db, `chats/${chatId}/messages`, messageId);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
              return success({ ...snapshot.data(), message_id: snapshot.id } as Message);
          }
          return fail("Message not found");
      } catch (e: any) {
          return fail(e.message);
      }
  },

  uploadImage: async (chatId: string, file: File): Promise<string> => {
      // Uses client-side compression and returns Base64 Data URL.
      // This bypasses CORS issues with Firebase Storage for local dev.
      return compressImage(file, 800, 800, 0.5);
  },

  uploadAudio: async (chatId: string, blob: Blob): Promise<string> => {
    // FIX: Using Base64 Data URI to bypass CORS issues on Firebase Storage for local/hybrid dev.
    // This stores audio directly in Firestore (Free tier limit 1MB per doc).
    // WebM audio is compact enough for short voice notes.
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to process audio data"));
            }
        };
        reader.onerror = (e) => reject(new Error("Audio processing failed"));
        reader.readAsDataURL(blob);
    });
  },

  sendMessage: async (
      chatId: string, 
      senderId: string, 
      content: string, 
      type: 'text' | 'encrypted' | 'image' | 'audio' = 'text',
      replyTo?: Message['replyTo'],
      customMessageId?: string
  ): Promise<ApiResponse<Message>> => {
    try {
      const timestamp = new Date().toISOString();
      const msgData: any = {
          chat_id: chatId,
          sender_id: senderId,
          message: content, 
          type: type,
          timestamp: timestamp,
          status: 'sent'
      };

      if (replyTo) {
          msgData.replyTo = replyTo;
      }

      let msgRef;
      if (customMessageId) {
          // Idempotent write using setDoc
          msgRef = doc(db, `chats/${chatId}/messages`, customMessageId);
          await setDoc(msgRef, msgData);
      } else {
          msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
      }
      
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

  toggleReaction: async (chatId: string, messageId: string, userId: string, reaction: string) => {
      try {
        const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
        const msgSnap = await getDoc(msgRef);
        
        if (msgSnap.exists()) {
            const currentReactions = msgSnap.data().reactions || {};
            const existingReaction = currentReactions[userId];

            if (existingReaction === reaction) {
                // Remove if same
                await updateDoc(msgRef, {
                    [`reactions.${userId}`]: deleteField()
                });
            } else {
                // Add or update
                await updateDoc(msgRef, {
                    [`reactions.${userId}`]: reaction
                });
            }
        }
      } catch (e) {
          console.error("Failed to toggle reaction", e);
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
          await updateDoc(doc(db, `chats/${chatId}/messages`, messageId), { status });
          
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

  // --- TYPING STATUS (RTDB) ---
  
  setTypingStatus: async (chatId: string, userId: string, isTyping: boolean) => {
      try {
        const typingRef = dbRef(rtdb, `typing/${chatId}/${userId}`);
        if (isTyping) {
            // Set timestamp and remove on disconnect
            await set(typingRef, serverTimestamp());
            onDisconnect(typingRef).remove();
        } else {
            await remove(typingRef);
        }
      } catch (e) {
          console.error("Typing status error", e);
      }
  },

  subscribeToChatTyping: (chatId: string, callback: (userIds: string[]) => void) => {
      const chatTypingRef = dbRef(rtdb, `typing/${chatId}`);
      return onValue(chatTypingRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              callback(Object.keys(data));
          } else {
              callback([]);
          }
      });
  },

  fetchSettings: async (): Promise<ApiResponse<AppSettings>> => {
      return success( { max_message_length: 1000, enable_groups: true, maintenance_mode: false, announcement: "" });
  },

  logEvent: async (event: LogEvent) => {}
};
