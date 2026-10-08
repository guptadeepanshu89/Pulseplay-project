export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  accent: string;
  accentMuted: string;

  positive: string;
  positiveMuted: string;
  negative: string;
  negativeMuted: string;
  warning: string;
  warningMuted: string;
  info: string;

  live: string;
  white: string;
  black: string;
  overlay: string;
}

export const darkColors: ColorPalette = {
  background: '#0B0D14',
  surface: '#14161F',
  surfaceElevated: '#1B1E2B',
  border: '#272B3A',

  textPrimary: '#F5F6FA',
  textSecondary: '#9298AB',
  textMuted: '#5C6178',

  accent: '#7C5CFC',
  accentMuted: '#7C5CFC26',

  positive: '#22C55E',
  positiveMuted: '#22C55E1F',
  negative: '#EF4444',
  negativeMuted: '#EF44441F',
  warning: '#F5B400',
  warningMuted: '#F5B4001F',
  info: '#3B82F6',

  live: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
  overlay: '#000000B3',
};

export const lightColors: ColorPalette = {
  background: '#F7F7FB',
  surface: '#FFFFFF',
  surfaceElevated: '#F4F1FC',
  border: '#E8E7F2',

  textPrimary: '#14161F',
  textSecondary: '#5B6170',
  textMuted: '#9195A5',

  accent: '#7C3AED',
  accentMuted: '#7C3AED17',

  positive: '#16A34A',
  positiveMuted: '#16A34A1A',
  negative: '#DC2626',
  negativeMuted: '#DC26261A',
  warning: '#D97706',
  warningMuted: '#D977061A',
  info: '#2563EB',

  live: '#DC2626',
  white: '#FFFFFF',
  black: '#000000',
  overlay: '#00000066',
};
