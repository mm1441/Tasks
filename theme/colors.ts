// theme/colors.ts
import type { ThemeColor } from '../utils/themeColors';
import { hexToHsl, hslToHex } from '../utils/themeColors';
import type { ThemeColorOption } from '../context/ThemeContext';

// Default theme colors (fallback)
const defaultLight = {
  name: 'light',
  // Light bluish-gray background (e.g., hsl(210, 20%, 95%))
  background: '#EAEFF6',
  // White surface for cards/modals
  surface: '#FFFFFF',
  // Vibrant pure blue for primary actions (e.g., hsl(205, 100%, 50%))
  primary: '#0084FF',
  // Dark gray/black for primary text
  text: '#333333',
  // Medium gray for inactive/secondary text
  muted: '#999999',
  // Light gray for borders
  border: '#E0E0E0',
  // Semi-transparent overlay
  overlay: 'rgba(0, 0, 0, 0.14)',
  // Very light gray for subtle backgrounds
  subtle: '#F5F5F5',
};

const defaultDark = {
  name: 'dark',
  // Very dark blue/navy background (#002c33)
  background: '#002c33',
  // Very dark surface (darker than background)
  surface: '#001F26',
  // Vibrant blue for primary actions (hsl(188, 100%, 36%)) 
  primary: '#009fb8',
  // White/very light gray for primary text
  text: '#F2F5F8',
  // Light gray for inactive/secondary text
  muted: '#9AA4AF',
  // Dark blue-gray for borders
  border: '#1F2933',
  // Semi-transparent overlay
  overlay: 'rgba(0, 0, 0, 0.33)',
  // Very dark for subtle backgrounds
  subtle: '#000F14',
};

export type AppTheme = typeof defaultLight;

/**
 * Generates theme colors based on scheme and selected theme color
 * @param scheme - 'light' or 'dark'
 * @param themeColorHex - Selected theme color hex (e.g., '#2a84f1')
 * @returns AppTheme object with dynamically generated colors
 */
export function getThemeColors(scheme: 'light' | 'dark', themeColorHex: ThemeColorOption): AppTheme {
  // Convert hex to HSL
  const hsl = hexToHsl(themeColorHex);
  
  // Generate background color with L = 20
  const backgroundHsl: ThemeColor = {
    h: hsl.h,
    s: hsl.s,
    l: 20,
  };
  const backgroundHex = hslToHex(backgroundHsl);
  
  // For light theme: lighter background, darker text
  // For dark theme: darker background, lighter text
  if (scheme === 'light') {
    return {
      name: 'light',
      background:' #FFFFFF', // backgroundHex,
      surface: '#FFFFFF',
      primary: themeColorHex,
      text: '#333333',
      muted: '#999999',
      border: '#E0E0E0',
      overlay: 'rgba(0, 0, 0, 0.14)',
      subtle: '#F5F5F5',
    };
  } else {
    // For dark theme, make background even darker
    const darkBackgroundHsl: ThemeColor = {
      h: hsl.h,
      s: hsl.s,
      l: 15, // Even darker for dark mode
    };
    const darkBackgroundHex = hslToHex(darkBackgroundHsl);
    
    const darkSurfaceHsl: ThemeColor = {
      h: hsl.h,
      s: hsl.s,
      l: 10, // Darker surface
    };
    const darkSurfaceHex = hslToHex(darkSurfaceHsl);
    
    return {
      name: 'dark',
      background: darkBackgroundHex,
      surface: darkSurfaceHex,
      primary: themeColorHex,
      text: '#F2F5F8',
      muted: '#9AA4AF',
      border: '#1F2933',
      overlay: 'rgba(0, 0, 0, 0.33)',
      subtle: '#000F14',
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
  const hsl = hexToHsl(themeColorHex);
  
  // For light theme, use higher lightness (around 50%)
  const lightBase: ThemeColor = {
    h: hsl.h,
    s: hsl.s,
    l: 50,
  };
  
  // For dark theme, use lower lightness (around 36%)
  const darkBase: ThemeColor = {
    h: hsl.h,
    s: hsl.s,
    l: 36,
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
