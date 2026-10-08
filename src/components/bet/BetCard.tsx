import { StyleSheet, View } from 'react-native';

import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { formatCurrency } from '@utils/formatCurrency';
import { formatOdds } from '@utils/formatOdds';
import { formatDateTime } from '@utils/formatDate';
import { Bet, BET_STATUS_BADGE } from '@/types/bet';

import { AppText, Badge, Touchable } from '@components/common';

interface BetCardProps {
  bet: Bet;
  onPress: () => void;
}

export function BetCard({ bet, onPress }: BetCardProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const firstLeg = bet.selections[0];
  const legLabel =
    bet.selections.length > 1
      ? `${bet.selections.length}-leg Accumulator`
      : `${firstLeg.selectionName} · ${firstLeg.marketName}`;

  const resultColor =
    bet.status === 'WON' ? colors.positive : bet.status === 'LOST' ? colors.negative : colors.textSecondary;

  return (
    <Touchable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <AppText variant="bodySemibold" numberOfLines={1} style={styles.eventName}>
          {firstLeg.eventName}
        </AppText>
        <Badge label={bet.status} status={BET_STATUS_BADGE[bet.status]} />
      </View>
      <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
        {legLabel}
      </AppText>

      <View style={styles.footer}>
        <View>
          <AppText variant="caption" color={colors.textMuted}>
            Stake {formatCurrency(bet.stake)} &middot; Odds {formatOdds(bet.combinedOdds)}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {formatDateTime(bet.placedAt)}
          </AppText>
        </View>
        <AppText variant="bodySemibold" color={resultColor}>
          {bet.status === 'LOST' || bet.status === 'VOID' ? '' : '+'}
          {formatCurrency(bet.status === 'LOST' ? 0 : bet.status === 'VOID' ? bet.stake : bet.potentialReturn)}
        </AppText>
      </View>
    </Touchable>
  );
}

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...cardElevation(colors, scheme),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xxs,
    },
    eventName: {
      flex: 1,
      marginRight: spacing.sm,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
  });
