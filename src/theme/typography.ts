import type { TextStyle } from 'react-native';

type TypographyVariant = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight'>;

const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const typography = {
  display: { fontSize: 32, fontWeight: fontWeight.bold, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: fontWeight.bold, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: fontWeight.semibold, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: fontWeight.semibold, lineHeight: 22 },
  bodyLarge: { fontSize: 16, fontWeight: fontWeight.regular, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: fontWeight.regular, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: fontWeight.medium, lineHeight: 20 },
  bodySemibold: { fontSize: 14, fontWeight: fontWeight.semibold, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: fontWeight.regular, lineHeight: 16 },
  captionMedium: { fontSize: 12, fontWeight: fontWeight.medium, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: fontWeight.semibold, lineHeight: 14 },
} as const satisfies Record<string, TypographyVariant>;

export type TypographyVariantName = keyof typeof typography;
