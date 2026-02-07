
import React, { createContext, useContext, useEffect, useState } from 'react';
import { databaseService } from '../services/databaseService';
import { Capacitor } from '@capacitor/core';

interface DatabaseContextType {
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initDB = async () => {
      // In a web environment without the proper assets (sql-wasm.wasm) copied during build,
      // initializing SQLite will crash with "fetching of the wasm failed".
      // We skip initialization here to force the DatabaseService to use its LocalStorage fallback.
      if (!Capacitor.isNativePlatform()) {
          console.warn("Web Platform detected: Skipping SQLite initialization to use LocalStorage fallback.");
          setIsReady(true);
          return;
      }

      try {
        await databaseService.init();
      } catch (e) {
        console.error("Database Service Init failed:", e);
      }
      setIsReady(true);
    };

    initDB();
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('useDatabase must be used within a DatabaseProvider');
  return context;
};
