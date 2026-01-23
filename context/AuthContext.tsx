
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { User } from '../types';
import { chatService } from '../services/chatService';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            // 1. Fetch Remote Profile First
            const userDocRef = doc(db, 'users', currentUser.uid);
            let remoteData: User | null = null;
            
            try {
                const snap = await getDoc(userDocRef);
                if (snap.exists()) {
                    remoteData = snap.data() as User;
                }
            } catch (e) {
                console.error("Failed to fetch user profile", e);
            }

            // 2. Handle Key Synchronization & Secure Storage Migration
            
            // Check Secure Storage first
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

            // Scenario: New Device / Cleared Storage -> Restore from Server
            if (!privKey && remoteData?.privateKey) {
                console.log("[Auth] Restoring keys from server...");
                privKey = remoteData.privateKey;
                await SecureStorage.set(`chatlix_priv_${currentUser.uid}`, privKey);
            }

            // Scenario: First time setup or Total Loss -> Generate New
            if (!privKey) {
                console.log("[Auth] Generating new KeyPair...");
                const keys = await generateKeyPair();
                privKey = keys.privateKey;
                pubKey = keys.publicKey;
                
                await SecureStorage.set(`chatlix_priv_${currentUser.uid}`, privKey);
                
                // Upload both keys to server
                await chatService.updateUserKeys(currentUser.uid, pubKey, privKey);
            }

            // 3. Set User State
            const finalUser: User = {
                 user_id: currentUser.uid,
                 username: remoteData?.username || currentUser.displayName || 'User',
                 email: currentUser.email || '',
                 status: 'online',
                 last_seen: new Date().toISOString(),
                 is_blocked: remoteData?.is_blocked || false,
                 publicKey: pubKey,
                 privateKey: privKey, // We keep it in state too just in case
                 enable_groups: remoteData?.enable_groups !== undefined ? remoteData.enable_groups : true
            };

            setUser(finalUser);
            setIsLoading(false);

            // 4. Initialize Realtime Presence (RTDB)
            chatService.initializePresence(currentUser.uid);

        } else {
            setUser(null);
            setIsLoading(false);
        }
    });

    return () => {
        unsubscribe();
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
    setUser(prev => prev ? { ...prev, username: name } : null);
  };
  
  const toggleGroupChats = async () => {
      if (!user) return;
      const newValue = !(user.enable_groups ?? true);
      await chatService.updateUserProfile(user.user_id, { enable_groups: newValue });
      setUser(prev => prev ? { ...prev, enable_groups: newValue } : null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateName, toggleGroupChats }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
