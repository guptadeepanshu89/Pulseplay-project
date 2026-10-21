import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ColorPalette, radius, spacing, typography } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from '@components/common';

interface StakeInputProps {
  value: number;
  onChange: (value: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export function StakeInput({ value, onChange }: StakeInputProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View>
      <View style={styles.inputRow}>
        <AppText variant="h2" color={colors.textSecondary}>
          ₹
        </AppText>
        <TextInput
          value={value === 0 ? '' : String(value)}
          onChangeText={(text) => {
            const numeric = Number(text.replace(/[^0-9]/g, ''));
            onChange(Number.isNaN(numeric) ? 0 : numeric);
          }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>
      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => onChange(value + amount)}
            style={({ pressed }) => [styles.quickButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText variant="bodyMedium" color={colors.accent}>
              +{amount}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingHorizontal: spacing.lg,
      height: 56,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      ...typography.h2,
    },
    quickRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    quickButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
    },
  });
