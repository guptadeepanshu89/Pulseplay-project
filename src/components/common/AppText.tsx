import { PropsWithChildren } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';

import { typography, TypographyVariantName } from '@theme';
import { useTheme } from '@context/ThemeContext';

interface AppTextProps extends TextProps, PropsWithChildren {
  variant?: TypographyVariantName;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color, align, style, children, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[typography[variant], { color: color ?? colors.textPrimary, textAlign: align }, style]} {...rest}>
      {children}
    </Text>
  );
}
