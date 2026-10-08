import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, ColorPalette } from '@theme';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeScheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  scheme: ThemeScheme;
  colors: ColorPalette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const scheme: ThemeScheme = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = scheme === 'light' ? lightColors : darkColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, scheme, colors, setMode }),
    [mode, scheme, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
