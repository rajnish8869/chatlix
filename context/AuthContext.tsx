import React, { createContext, useState, useContext, useEffect } from 'react';
import { User } from '../types';
import { sheetService } from '../services/sheetService';

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

  // Load user from local storage (Capacitor Preferences mock) on boot
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = localStorage.getItem('sheet_chat_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<{success: boolean, error?: string}> => {
    // We do NOT set global isLoading here to allow the Login component to handle its own UI state
    const result = await sheetService.login(email, password);

    if (result.success && result.data) {
      setUser(result.data);
      localStorage.setItem('sheet_chat_user', JSON.stringify(result.data));
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  };

  const signup = async (username: string, email: string, password: string): Promise<{success: boolean, error?: string}> => {
    // We do NOT set global isLoading here to allow the Login component to handle its own UI state
    const result = await sheetService.signup(username, email, password);

    if (result.success && result.data) {
      setUser(result.data);
      localStorage.setItem('sheet_chat_user', JSON.stringify(result.data));
      return { success: true };
    }
    return { success: false, error: result.error || 'Signup failed' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sheet_chat_user');
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