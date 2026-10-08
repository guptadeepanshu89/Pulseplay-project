import { StyleSheet, View } from 'react-native';

import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { formatCurrency } from '@utils/formatCurrency';

import { AppButton, AppText, IconBadge } from '@components/common';

interface BalanceCardProps {
  availableBalance: number;
  lockedBalance: number;
  onAddFunds: () => void;
}

export function BalanceCard({ availableBalance, lockedBalance, onAddFunds }: BalanceCardProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const totalBalance = availableBalance + lockedBalance;
  const availableShare = totalBalance > 0 ? availableBalance / totalBalance : 1;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <IconBadge icon="wallet-outline" size={TITLE_ICON_SIZE} iconSize={layout.iconSizeSmall} />
        <AppText variant="captionMedium" color={colors.textSecondary}>
          Total Balance
        </AppText>
      </View>
      <AppText variant="display" style={styles.total}>
        {formatCurrency(totalBalance)}
      </AppText>

      <View style={styles.splitTrack}>
        <View style={[styles.splitFill, { flex: availableShare }]} />
        <View style={{ flex: 1 - availableShare }} />
      </View>

      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <IconBadge
            icon="arrow-down-circle-outline"
            size={BREAKDOWN_ICON_SIZE}
            iconSize={layout.iconSizeSmall}
            color={colors.positive}
            backgroundColor={colors.positiveMuted}
          />
          <View>
            <AppText variant="caption" color={colors.textSecondary}>
              Available
            </AppText>
            <AppText variant="bodySemibold" color={colors.positive}>
              {formatCurrency(availableBalance)}
            </AppText>
          </View>
        </View>
        <View style={styles.breakdownItem}>
          <IconBadge
            icon="lock-closed-outline"
            size={BREAKDOWN_ICON_SIZE}
            iconSize={layout.iconSizeSmall}
            color={colors.warning}
            backgroundColor={colors.warningMuted}
          />
          <View>
            <AppText variant="caption" color={colors.textSecondary}>
              Locked in Bets
            </AppText>
            <AppText variant="bodySemibold" color={colors.warning}>
              {formatCurrency(lockedBalance)}
            </AppText>
          </View>
        </View>
      </View>

      <AppButton label="Add Funds" onPress={onAddFunds} variant="primary" fullWidth />
    </View>
  );
}

const TITLE_ICON_SIZE = 26;
const BREAKDOWN_ICON_SIZE = 28;
const SPLIT_TRACK_HEIGHT = 6;

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...cardElevation(colors, scheme),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    total: {
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    splitTrack: {
      flexDirection: 'row',
      height: SPLIT_TRACK_HEIGHT,
      borderRadius: radius.full,
      backgroundColor: colors.warningMuted,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    splitFill: {
      backgroundColor: colors.positive,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginBottom: spacing.lg,
    },
    breakdownItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
  });
