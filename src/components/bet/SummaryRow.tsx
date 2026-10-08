import { StyleSheet, View } from 'react-native';

import { spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from '@components/common';

interface SummaryRowProps {
  label: string;
  value: string;
  valueColor: string;
  emphasize?: boolean;
}

export function SummaryRow({ label, value, valueColor, emphasize = false }: SummaryRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <AppText variant="body" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant={emphasize ? 'h3' : 'bodySemibold'} color={valueColor}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
