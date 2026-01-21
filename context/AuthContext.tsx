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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            // Fetch extended profile from Firestore
            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    setUser(userDoc.data() as User);
                    
                    // Set online
                    updateDoc(doc(db, 'users', currentUser.uid), {
                        status: 'online',
                        last_seen: new Date().toISOString()
                    }).catch(e => console.error("Error updating online status", e));

                } else {
                    // Fallback if doc missing
                     setUser({
                         user_id: currentUser.uid,
                         username: currentUser.displayName || 'User',
                         email: currentUser.email || '',
                         status: 'online',
                         last_seen: new Date().toISOString(),
                         is_blocked: false
                     });
                }
            } catch (e) {
                console.error("Error fetching user profile", e);
                setUser({
                    user_id: currentUser.uid,
                    username: currentUser.displayName || 'User',
                    email: currentUser.email || '',
                    status: 'offline',
                    last_seen: new Date().toISOString(),
                    is_blocked: false
                });
            }
        } else {
            // Set offline if we had a user
            if (user) {
                // Note: This often doesn't fire on tab close, but works on explicit logout
                // Use 'onDisconnect' in Realtime Database for true presence, or Firestore listeners
            }
            setUser(null);
        }
        setIsLoading(false);
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
             // Set offline before signing out
             await updateDoc(doc(db, 'users', user.user_id), {
                status: 'offline',
                last_seen: new Date().toISOString()
            }).catch(console.error);
        }
        await signOut(auth);
        setUser(null);
    } catch (e) {
        console.error("Logout failed", e);
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