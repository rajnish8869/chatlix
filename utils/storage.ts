
import { databaseService } from '../services/databaseService';

// Abstraction for Secure Storage
export const SecureStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      // Prioritize SQLite for data persistence if initialized
      if (databaseService.db) {
         const val = await databaseService.getKv(key);
         if (val) return val;
      }
      
      // Fallback to localStorage (and for keys in this mock env)
      return localStorage.getItem(key);
    } catch (e) {
      console.error("SecureStorage Get Error", e);
      return null;
    }
  },

  set: async (key: string, value: string): Promise<void> => {
    try {
      if (databaseService.db) {
          await databaseService.setKv(key, value);
      }
      // Keep localStorage in sync for fallback/bootstrapping
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("SecureStorage Set Error", e);
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      if (databaseService.db) {
          await databaseService.removeKv(key);
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.error("SecureStorage Remove Error", e);
    }
  }
};
