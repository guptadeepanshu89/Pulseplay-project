import { StyleSheet, View } from 'react-native';

import { ColorPalette, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import { formatOdds } from '@utils/formatOdds';
import { BetSlipSelection } from '@/types/bet';

import { AppText, IconButton } from '@components/common';

interface BetSlipItemProps {
  selection: BetSlipSelection;
  onRemove: () => void;
}

const REMOVE_ICON_SIZE = 20;

export function BetSlipItem({ selection, onRemove }: BetSlipItemProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <View style={styles.details}>
        <AppText variant="bodySemibold">{selection.selectionName}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {selection.marketName} &middot; {selection.eventName}
        </AppText>
      </View>
      <AppText variant="bodySemibold" color={colors.accent} style={styles.price}>
        {formatOdds(selection.price)}
      </AppText>
      <IconButton name="close-circle" onPress={onRemove} color={colors.textMuted} size={REMOVE_ICON_SIZE} />
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    details: {
      flex: 1,
      gap: spacing.xxs,
    },
    price: {
      marginRight: spacing.sm,
    },
  });
