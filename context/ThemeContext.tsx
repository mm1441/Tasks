// context/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeColors, type AppTheme, type ThemeColorOption } from '../theme/colors';
import type { ReactNode } from 'react';

const STORAGE_KEY = '@app_theme'; // stores 'light' or 'dark'
const THEME_COLOR_STORAGE_KEY = '@app_theme_color'; // stores theme color hex or 'default'

export type { ThemeColorOption };

type ThemeContextValue = {
  theme: AppTheme;
  scheme: 'light' | 'dark';
  themeColor: ThemeColorOption;
  toggleTheme: () => Promise<void>;
  setScheme: (s: 'light' | 'dark') => Promise<void>;
  setThemeColor: (color: ThemeColorOption) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<'light' | 'dark'>('light'); // default
  const [themeColor, setThemeColorState] = useState<ThemeColorOption>('default'); // default
  const theme = useMemo(() => getThemeColors(scheme, themeColor), [scheme, themeColor]);

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
        
        const storedColor = await AsyncStorage.getItem(THEME_COLOR_STORAGE_KEY);
        const validColors: readonly ThemeColorOption[] = ['default', '#09b895', '#0084FF', '#c2791d'];
        if (storedColor && (validColors as readonly string[]).includes(storedColor)) {
          setThemeColorState(storedColor as ThemeColorOption);
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

  const setThemeColor = async (color: ThemeColorOption) => {
    setThemeColorState(color);
    try {
      await AsyncStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
    } catch (e) {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, scheme, themeColor, toggleTheme, setScheme, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
