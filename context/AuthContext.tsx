
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { User } from '../types';
import { chatService } from '../services/chatService';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { generateKeyPair } from '../utils/crypto';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{success: boolean, error?: string}>;
  signup: (username: string, email: string, password: string) => Promise<{success: boolean, error?: string}>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatInterval = useRef<any>(null);

  // --- Crypto Key Management ---
  const ensureKeysExist = async (uid: string) => {
    const privKey = localStorage.getItem(`chatlix_priv_${uid}`);
    if (!privKey) {
        console.log("Generating new E2EE keys...");
        const keys = await generateKeyPair();
        localStorage.setItem(`chatlix_priv_${uid}`, keys.privateKey);
        // We will upload the public key to Firestore shortly
        return keys.publicKey;
    }
    return null; // Keys exist
  };

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            // 1. Optimistic User Set
            const optimisticUser: User = {
                 user_id: currentUser.uid,
                 username: currentUser.displayName || 'User',
                 email: currentUser.email || '',
                 status: 'online',
                 last_seen: new Date().toISOString(),
                 is_blocked: false
            };
            setUser(prev => {
                if (prev?.user_id === currentUser.uid) return prev;
                return optimisticUser;
            });
            setIsLoading(false);

            // 2. Ensure Crypto Keys
            const newPubKey = await ensureKeysExist(currentUser.uid);
            if (newPubKey) {
                await chatService.updateUserPublicKey(currentUser.uid, newPubKey);
            }

            // 3. Sync Profile
            getDoc(doc(db, 'users', currentUser.uid)).then(async (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as User;
                    setUser(prev => ({ ...prev, ...data, status: 'online' } as User));
                    
                    // If public key missing on server but exists locally (or just generated), upload it
                    if (!data.publicKey && !newPubKey) {
                         const keys = await generateKeyPair(); // Should not happen if local storage works, but fail-safe
                         localStorage.setItem(`chatlix_priv_${currentUser.uid}`, keys.privateKey);
                         await chatService.updateUserPublicKey(currentUser.uid, keys.publicKey);
                    }
                }
            });

            // 4. Start Heartbeat (Real-time Presence)
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            chatService.updateHeartbeat(currentUser.uid); // Immediate update
            
            heartbeatInterval.current = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    chatService.updateHeartbeat(currentUser.uid);
                }
            }, 60000); // Update every 60s

        } else {
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            setUser(null);
            setIsLoading(false);
        }
    });

    // Offline on window close
    const handleUnload = () => {
        if (auth.currentUser) {
            // Attempt to set offline. Note: unreliable in some browsers.
            navigator.sendBeacon && navigator.sendBeacon("...", "offline"); 
            // We rely more on 'last_seen' timeout logic for other users.
        }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
        unsubscribe();
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
        window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const login = async (email: string, password: string) => chatService.login(email, password);
  const signup = async (username: string, email: string, password: string) => chatService.signup(username, email, password);

  const logout = async () => {
    if (user) await chatService.setUserOffline(user.user_id);
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
