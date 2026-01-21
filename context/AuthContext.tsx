
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
  updateName: (name: string) => Promise<void>;
  toggleGroupChats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatInterval = useRef<any>(null);

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

            // 2. Handle Key Synchronization
            // - Check Local Storage
            // - Check Remote Storage
            // - Generate if missing
            
            let privKey = localStorage.getItem(`chatlix_priv_${currentUser.uid}`);
            let pubKey = remoteData?.publicKey;

            // Scenario: New Device / Cleared Storage -> Restore from Server
            if (!privKey && remoteData?.privateKey) {
                console.log("[Auth] Restoring keys from server...");
                privKey = remoteData.privateKey;
                localStorage.setItem(`chatlix_priv_${currentUser.uid}`, privKey);
            }

            // Scenario: First time setup or Total Loss -> Generate New
            if (!privKey) {
                console.log("[Auth] Generating new KeyPair...");
                const keys = await generateKeyPair();
                privKey = keys.privateKey;
                pubKey = keys.publicKey;
                
                localStorage.setItem(`chatlix_priv_${currentUser.uid}`, privKey);
                
                // Upload both keys to server
                await chatService.updateUserKeys(currentUser.uid, pubKey, privKey);
            } else {
                // We have a private key. Ensure public key is consistent on server.
                // If the server doesn't have a public key, we upload the one we can (if we just generated it). 
                // But if we just restored from local, we assume server logic is fine.
                // If remoteData is missing completely (new user created via Login UI but doc not made yet? rare), we might need to update.
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
            navigator.sendBeacon && navigator.sendBeacon("...", "offline"); 
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