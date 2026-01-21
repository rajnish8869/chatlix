import React, { createContext, useState, useContext, useEffect } from 'react';
import { User } from '../types';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch extended user details from Firestore
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                setUser(userDoc.data() as User);
            } else {
                // Fallback if doc doesn't exist yet (shouldn't happen in normal flow)
                setUser({
                    user_id: firebaseUser.uid,
                    username: firebaseUser.displayName || 'User',
                    email: firebaseUser.email || '',
                    status: 'online',
                    last_seen: new Date().toISOString(),
                    is_blocked: false
                });
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{success: boolean, error?: string}> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: any) {
      let msg = "Login failed";
      if (error.code === 'auth/invalid-credential') msg = "Invalid email or password";
      if (error.code === 'auth/user-not-found') msg = "User not found";
      if (error.code === 'auth/wrong-password') msg = "Incorrect password";
      return { success: false, error: msg };
    }
  };

  const signup = async (username: string, email: string, password: string): Promise<{success: boolean, error?: string}> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update Display Name
      await updateProfile(firebaseUser, { displayName: username });

      // Create User Document in Firestore
      const newUser: User = {
        user_id: firebaseUser.uid,
        username: username,
        email: email,
        status: 'online',
        last_seen: new Date().toISOString(),
        is_blocked: false
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      
      // State update is handled by onAuthStateChanged listener
      return { success: true };
    } catch (error: any) {
      let msg = "Signup failed";
      if (error.code === 'auth/email-already-in-use') msg = "Email already in use";
      if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters";
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
        await signOut(auth);
    } catch (e) {
        console.error(e);
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