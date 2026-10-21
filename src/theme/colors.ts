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
  background: '#070B18',
  surface: '#10182C',
  surfaceElevated: '#182640',
  border: '#2C3E62',

  textPrimary: '#F7F8FF',
  textSecondary: '#C3CCE0',
  textMuted: '#8B97B3',

  accent: '#8B6CFF',
  accentMuted: '#8B6CFF33',

  positive: '#3DDC97',
  positiveMuted: '#3DDC9726',
  negative: '#FF5C7A',
  negativeMuted: '#FF5C7A24',
  warning: '#F5B942',
  warningMuted: '#F5B94224',
  info: '#4C8DFF',

  live: '#FF4D6A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: '#050814CC',
};

export const lightColors: ColorPalette = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceElevated: '#F3EEFF',
  border: '#E4E0F4',

  textPrimary: '#12162A',
  textSecondary: '#4E5670',
  textMuted: '#8A90A6',

  accent: '#6D4AFF',
  accentMuted: '#6D4AFF1A',

  positive: '#0F9F6E',
  positiveMuted: '#0F9F6E1A',
  negative: '#E11D48',
  negativeMuted: '#E11D4814',
  warning: '#D97706',
  warningMuted: '#D977061A',
  info: '#2563EB',

  live: '#E11D48',
  white: '#FFFFFF',
  black: '#000000',
  overlay: '#00000066',
};
