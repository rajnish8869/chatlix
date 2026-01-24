

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { User } from '../types';
import { chatService } from '../services/chatService';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { generateKeyPair } from '../utils/crypto';
import { SecureStorage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{success: boolean, error?: string}>;
  signup: (username: string, email: string, password: string) => Promise<{success: boolean, error?: string}>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  toggleGroupChats: () => Promise<void>;
  updateProfilePicture: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        // Clear previous listener if any
        if (profileUnsub) {
            profileUnsub();
            profileUnsub = null;
        }

        if (currentUser) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            
            // --- One-time Key Setup ---
            // Fetch once to check keys without setting up listener yet
            let initialSnap = await getDoc(userDocRef);
            let remoteData = initialSnap.exists() ? initialSnap.data() as User : null;

            let privKey = await SecureStorage.get(`chatlix_priv_${currentUser.uid}`);
            let pubKey = remoteData?.publicKey;

            // Migration: Check LocalStorage if SecureStorage is empty
            if (!privKey) {
                const legacyKey = localStorage.getItem(`chatlix_priv_${currentUser.uid}`);
                if (legacyKey) {
                    console.log("[Auth] Migrating key to SecureStorage");
                    await SecureStorage.set(`chatlix_priv_${currentUser.uid}`, legacyKey);
                    localStorage.removeItem(`chatlix_priv_${currentUser.uid}`);
                    privKey = legacyKey;
                }
            }

            // Restore from Server if lost locally
             if (!privKey && remoteData?.privateKey) {
                 console.log("[Auth] Restoring keys from server...");
                 privKey = remoteData.privateKey;
                 await SecureStorage.set(`chatlix_priv_${currentUser.uid}`, privKey);
             }

             // Generate new if totally missing
             if (!privKey) {
                 console.log("[Auth] Generating new KeyPair...");
                 const keys = await generateKeyPair();
                 privKey = keys.privateKey;
                 pubKey = keys.publicKey;
                 await SecureStorage.set(`chatlix_priv_${currentUser.uid}`, privKey);
                 await chatService.updateUserKeys(currentUser.uid, pubKey, privKey);
             }

             // Initialize Presence (RTDB)
             chatService.initializePresence(currentUser.uid);

             // --- Realtime Profile Listener ---
             // This is crucial for "Blocked Users" list updates to reflect immediately
             profileUnsub = onSnapshot(userDocRef, (docSnap) => {
                 const data = docSnap.data() as User | undefined;
                 
                 const finalUser: User = {
                     user_id: currentUser.uid,
                     username: data?.username || currentUser.displayName || 'User',
                     email: currentUser.email || '',
                     status: 'online',
                     last_seen: new Date().toISOString(),
                     is_blocked: data?.is_blocked || false,
                     publicKey: data?.publicKey || pubKey, 
                     privateKey: privKey || undefined, 
                     enable_groups: data?.enable_groups ?? true,
                     profile_picture: data?.profile_picture,
                     blocked_users: data?.blocked_users || [], // Real-time update here
                     chat_wallpapers: data?.chat_wallpapers
                 };
                 
                 setUser(finalUser);
                 setIsLoading(false);
             });

        } else {
            setUser(null);
            setIsLoading(false);
        }
    });

    return () => {
        unsubscribe();
        if (profileUnsub) profileUnsub();
    };
  }, []);

  const login = async (email: string, password: string) => chatService.login(email, password);
  const signup = async (username: string, email: string, password: string) => chatService.signup(username, email, password);

  const logout = async () => {
    if (user) await chatService.setUserOffline(user.user_id);
    await signOut(auth);
    setUser(null);
  };

  const updateName = async (name: string) => {
    if (!user) return;
    await chatService.updateUserProfile(user.user_id, { username: name });
  };
  
  const toggleGroupChats = async () => {
      if (!user) return;
      const newValue = !(user.enable_groups ?? true);
      await chatService.updateUserProfile(user.user_id, { enable_groups: newValue });
  };

  const updateProfilePicture = async (file: File) => {
      if (!user) return;
      await chatService.uploadProfilePicture(user.user_id, file);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateName, toggleGroupChats, updateProfilePicture }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};