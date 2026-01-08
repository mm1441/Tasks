// theme/colors.ts
export const light = {
  name: 'light',
  background: '#f5f5f5',
  surface: '#ffffff',
  primary: '#007AFF',
  text: '#111111',
  muted: '#636363ff',
  border: '#e6e6e6',
  overlay: 'rgba(0,0,0,0.4)',
  subtle: '#fafafa',
};

export const dark = {
  name: 'dark',
  background: '#162b43ff',
  surface: '#0b1220',
  primary: '#0EA5E9',
  text: '#f2f5f8',
  muted: '#9aa4af',
  border: '#1f2933',
  overlay: 'rgba(0,0,0,0.6)',
  subtle: '#07101a',
};

export type AppTheme = typeof light;
