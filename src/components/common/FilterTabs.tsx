import { ScrollView, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';
import { Touchable } from './Touchable';

export interface FilterOption<T extends string> {
  key: T;
  label: string;
}

interface FilterTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

const CHIP_HEIGHT = 36;
const ROW_HEIGHT = CHIP_HEIGHT + spacing.md * 2;

export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
        {options.map((option) => {
          const active = option.key === value;
          return (
            <Touchable
              key={option.key}
              onPress={() => onChange(option.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <AppText variant="bodyMedium" color={active ? colors.white : colors.textSecondary}>
                {option.label}
              </AppText>
            </Touchable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexShrink: 0,
  },
  container: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.md,
    paddingRight: layout.screenPaddingHorizontal + spacing.lg,
  },
  chip: {
    height: CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
