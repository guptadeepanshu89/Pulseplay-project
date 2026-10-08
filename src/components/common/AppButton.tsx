import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { platformShadow, radius, spacing, typography } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const SIZE_STYLES: Record<ButtonSize, { height: number; paddingHorizontal: number }> = {
  md: { height: 44, paddingHorizontal: spacing.xl },
  lg: { height: 52, paddingHorizontal: spacing.xxl },
};

const PRIMARY_SHADOW_OFFSET_HEIGHT = 6;
const PRIMARY_SHADOW_OPACITY = 0.22;
const PRIMARY_SHADOW_RADIUS = 10;
const PRIMARY_ELEVATION = 3;

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: AppButtonProps) {
  const { colors, scheme } = useTheme();

  const variantStyles: Record<ButtonVariant, { background: string; text: string; border?: string }> = {
    primary: { background: colors.accent, text: colors.white },
    secondary: { background: colors.surfaceElevated, text: colors.textPrimary, border: colors.border },
    ghost: { background: 'transparent', text: colors.accent },
    danger: { background: colors.negative, text: colors.white },
  };

  const variantStyle = variantStyles[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;
  const showLiftShadow = variant === 'primary' && scheme === 'light' && !isDisabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: variantStyle.background,
          borderColor: variantStyle.border ?? 'transparent',
          borderWidth: variantStyle.border ? 1 : 0,
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        showLiftShadow &&
          platformShadow({
            color: colors.accent,
            offsetHeight: PRIMARY_SHADOW_OFFSET_HEIGHT,
            opacity: PRIMARY_SHADOW_OPACITY,
            radius: PRIMARY_SHADOW_RADIUS,
            elevation: PRIMARY_ELEVATION,
          }),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} />
      ) : (
        <AppText style={{ ...typography.bodySemibold, color: variantStyle.text }}>{label}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
