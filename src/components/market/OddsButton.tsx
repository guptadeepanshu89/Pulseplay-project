import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import { formatOdds } from '@utils/formatOdds';

import { AppText } from '@components/common';

interface OddsButtonProps {
  label: string;
  price: number;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function OddsButton({ label, price, selected = false, disabled = false, onPress }: OddsButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceElevated,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <AppText
          variant="caption"
          color={selected ? colors.white : colors.textSecondary}
          numberOfLines={1}
          align="center"
        >
          {label}
        </AppText>
        <AppText
          variant="bodySemibold"
          color={selected ? colors.white : colors.textPrimary}
          numberOfLines={1}
          align="center"
        >
          {formatOdds(price)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
});
