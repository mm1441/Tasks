// context/ThemeContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, type AppTheme } from '../theme/colors';
import type { ReactNode } from 'react';

const STORAGE_KEY = '@app_theme'; // stores 'light' or 'dark'

type ThemeContextValue = {
  theme: AppTheme;
  scheme: 'light' | 'dark';
  toggleTheme: () => Promise<void>;
  setScheme: (s: 'light' | 'dark') => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<'light' | 'dark'>('light'); // default
  const theme = scheme === 'dark' ? dark : light;

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setSchemeState(stored);
        } else {
          // optional: detect system preference with Appearance
          // import { Appearance } from 'react-native';
          // const sys = Appearance.getColorScheme();
          // if (sys) setSchemeState(sys);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const persist = async (s: 'light' | 'dark') => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, s);
    } catch (e) {
      // ignore
    }
  };

  const toggleTheme = async () => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    setSchemeState(next);
    await persist(next);
  };

  const setScheme = async (s: 'light' | 'dark') => {
    setSchemeState(s);
    await persist(s);
  };

  return (
    <ThemeContext.Provider value={{ theme, scheme, toggleTheme, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
