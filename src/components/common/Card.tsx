import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { ThemeScheme, useTheme } from '@context/ThemeContext';

interface CardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof PADDING_MAP;
}

const PADDING_MAP = {
  none: spacing.none,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
};

export function Card({ children, style, padding = 'md' }: CardProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  return <View style={[styles.base, { padding: PADDING_MAP[padding] }, style]}>{children}</View>;
}

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardElevation(colors, scheme),
    },
  });
