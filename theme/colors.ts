// theme/colors.ts
import type { ThemeColor } from '../utils/themeColors';
import { hexToHsl, hslToHex } from '../utils/themeColors';

export type ThemeColorOption = 'default' | '#00ba95' | '#0084FF' | '#c2791d';

export const THEME_COLOR_OPTIONS: ReadonlyArray<{ color: ThemeColorOption; label: string }> = [
  { color: 'default', label: 'Default' },
  { color: '#00ba95', label: 'Teal' },
  { color: '#0084FF', label: 'Blue' }, // Use #0084FF for dark, #99D1FF for light theme.
  { color: '#c2791d', label: 'Orange' },
];

// Default theme colors (fallback)
const defaultLight = {
  name: 'light',
  // Light bluish-gray background (e.g., hsl(210, 20%, 95%))
  background: 'rgb(246, 247, 250)',
  // White surface for cards/modals
  surface: '#FFFFFF',
  // Vibrant pure blue for primary actions (e.g., hsl(205, 100%, 50%))
  primary: '#0084FF',
  taskBackground: '#0084FF',
  // Dark gray/black for primary text
  text: '#333333',
  // Medium gray for inactive/secondary text
  muted: 'rgba(0, 0, 0, 0.5)',
  dueDateText: 'rgba(0, 0, 0, 0.5)',
  // Light gray for borders
  border: '#E0E0E0',
  // Semi-transparent overlay
  overlay: 'rgba(0, 0, 0, 0.14)',
  // Very light gray for subtle backgrounds
  subtle: '#F5F5F5',
  error: '#FF0000',
};

const defaultDark = {
  name: 'dark',
  background: '#252525',
  surface: 'rgba(255, 255, 255, 0.04)',
  // Vibrant blue for primary actions (hsl(188, 100%, 36%)) 
  primary: '#0084FF',
  taskBackground: '#0084FF',
  // White/very light gray for primary text
  text: '#F2F5F8',
  // Light gray for inactive/secondary text
  muted: 'rgba(255, 255, 255, 0.4)',
  dueDateText: 'rgba(255, 255, 255, 0.6)',
  // Dark blue-gray for borders
  border: 'rgb(66, 66, 66)',
  // Semi-transparent overlay
  overlay: 'rgba(0, 0, 0, 0.33)',
  // Very dark for subtle backgrounds
  subtle: '#000F14',
  error: '#FF0000',
};

export type AppTheme = typeof defaultLight;

export function getDefaultThemeColors(scheme: 'light' | 'dark'): AppTheme {
  return scheme === 'dark' ? defaultDark : defaultLight;
}

/**
 * Generates theme colors based on scheme and selected theme color
 * @param scheme - 'light' or 'dark'
 * @param themeColorHex - Selected theme color hex
 * @returns AppTheme object with dynamically generated colors
 */
export function getThemeColors(scheme: 'light' | 'dark', themeColorHex: ThemeColorOption): AppTheme {
  if (themeColorHex === 'default') {
    return getDefaultThemeColors(scheme);
  }

  const hsl = hexToHsl(themeColorHex);

  if (scheme === 'light') {
    const lightBase: ThemeColor = {
      h: hsl.h,
      s: hsl.s,
      l: Math.min(100, hsl.l + 30),
    };
    const lightBackgroundHsl: ThemeColor = {
      h: hsl.h,
      s: hsl.s,
      l: 98,
    };
    return {
      ...defaultLight,
      background: hslToHex(lightBackgroundHsl),
      primary: hslToHex(hsl),
      // taskBackground: hslToHex(lightBase),
    };
  } else {
    const darkBase: ThemeColor = {
      h: hsl.h,
      s: hsl.s,
      l: Math.max(0, hsl.l),
    };
    const darkBackgroundHsl: ThemeColor = {
      h: darkBase.h,
      s: darkBase.s,
      l: 8,
    };
    const darkSurfaceHsl: ThemeColor = {
      h: darkBase.h,
      s: darkBase.s,
      l: 5,
    };
    return {
      ...defaultDark,
      background: hslToHex(darkBackgroundHsl),
      surface: hslToHex(darkSurfaceHsl),
      primary: hslToHex(darkBase),
      // taskBackground: hslToHex(darkBase),
    };
  }

}

// Legacy exports for backward compatibility
export const light = defaultLight;
export const dark = defaultDark;

/**
 * Gets gradient theme base colors based on selected theme color
 * @param themeColorHex - Selected theme color hex
 * @returns Object with light and dark gradient theme bases
 */
export function getGradientThemeBases(themeColorHex: ThemeColorOption): {
  light: ThemeColor;
  dark: ThemeColor;
} {
  if (themeColorHex === 'default') {
    return {
      light: gradientThemeBaseLight,
      dark: gradientThemeBaseDark,
    };
  }
  const hsl = hexToHsl(themeColorHex);
  
  const lightBase: ThemeColor = {
    h: hsl.h,
    s: hsl.s,
    l: hsl.l + 33,
  };
  
  const darkBase: ThemeColor = {
    h: hsl.h,
    s: hsl.s,
    l: hsl.l,
  };
  
  return {
    light: lightBase,
    dark: darkBase,
  };
}

// Legacy exports for backward compatibility
export const gradientThemeBaseLight: ThemeColor = {
  h: 205,
  s: 100,
  l: 50,
};

export const gradientThemeBaseDark: ThemeColor = {
  h: 188,
  s: 100,
  l: 36,
};

export const gradientThemeBase = gradientThemeBaseDark;
