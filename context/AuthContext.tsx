import React, { createContext, useState, useContext, useEffect } from 'react';
import { User } from '../types';
import { chatService } from '../services/chatService';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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

  // Firebase Auth Listener
  useEffect(() => {
    console.log("[AuthContext] Setting up onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        console.log("[AuthContext] Auth state changed. User:", currentUser?.uid);
        
        if (currentUser) {
            // OPTIMISTIC UPDATE: 
            // Set user immediately from Auth data to unblock UI.
            const optimisticUser: User = {
                 user_id: currentUser.uid,
                 username: currentUser.displayName || 'User',
                 email: currentUser.email || '',
                 status: 'online',
                 last_seen: new Date().toISOString(),
                 is_blocked: false
            };
            
            // Only update state if meaningful change to prevent flickers
            setUser(prev => {
                if (prev?.user_id === currentUser.uid) return prev;
                console.log("[AuthContext] Setting optimistic user state");
                return optimisticUser;
            });
            setIsLoading(false); // Unblock the app immediately

            // BACKGROUND SYNC:
            // Fetch extended profile from Firestore to get custom username/block status
            console.log("[AuthContext] Starting background profile sync...");
            getDoc(doc(db, 'users', currentUser.uid))
            .then(userDoc => {
                console.log("[AuthContext] Background profile sync result - Exists:", userDoc.exists());
                if (userDoc.exists()) {
                    const firestoreData = userDoc.data() as User;
                    // Merge Firestore data with current state
                    setUser(prev => ({ ...prev, ...firestoreData, status: 'online' } as User));
                }
                
                // Fire and forget online status
                updateDoc(doc(db, 'users', currentUser.uid), {
                    status: 'online',
                    last_seen: new Date().toISOString()
                }).catch(e => console.warn("[AuthContext] Background online status update failed", e));
            })
            .catch(e => {
                // Downgrade offline errors to warning, as app is functional via optimistic state
                if (e.message && e.message.includes('offline')) {
                    console.warn("[AuthContext] Background sync skipped (Client Offline)");
                } else {
                    console.error("[AuthContext] Error background fetching user profile:", e);
                }
            });

        } else {
            // When currentUser is null (logged out)
            console.log("[AuthContext] User logged out, clearing state");
            setUser(null);
            setIsLoading(false);
        }
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{success: boolean, error?: string}> => {
    return chatService.login(email, password);
  };

  const signup = async (username: string, email: string, password: string): Promise<{success: boolean, error?: string}> => {
    return chatService.signup(username, email, password);
  };

  const logout = async () => {
    try {
        if (user) {
             // Fire and forget - do not await. 
             // This prevents the logout process from hanging if Firestore/Network is unresponsive.
             updateDoc(doc(db, 'users', user.user_id), {
                status: 'offline',
                last_seen: new Date().toISOString()
            }).catch(e => console.warn("Failed to set offline status on logout", e));
        }
        await signOut(auth);
    } catch (e) {
        console.error("Logout failed", e);
    } finally {
        // CRITICAL: Always clear user state, even if Firebase errors out
        setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};