import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'midnight' | 'daylight' | 'eclipse';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('midnight');
  const STORAGE_KEY = 'chatlix_theme';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme;
    if (saved) {
        setThemeState(saved);
        document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};