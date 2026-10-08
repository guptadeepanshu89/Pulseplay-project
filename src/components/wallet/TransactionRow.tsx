import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ColorPalette, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import { formatCurrency } from '@utils/formatCurrency';
import { formatDateTime } from '@utils/formatDate';
import { WalletTransactionType } from '@/types/wallet';

import { AppText, Badge, IconBadge } from '@components/common';
import type { BadgeStatus } from '@components/common';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TransactionRowProps {
  type: WalletTransactionType;
  amount: number;
  createdAt: string;
  statusLabel?: string;
  statusVariant?: BadgeStatus;
}

const TYPE_META: Record<WalletTransactionType, { label: string; icon: IoniconName }> = {
  BET_LOCK: { label: 'Bet Placed', icon: 'ticket-outline' },
  BET_SETTLEMENT: { label: 'Bet Settled', icon: 'trophy-outline' },
  BET_REFUND: { label: 'Bet Refund', icon: 'arrow-undo-outline' },
  ADMIN_CREDIT: { label: 'Deposit Approved', icon: 'arrow-down-circle-outline' },
  ADMIN_DEBIT: { label: 'Withdrawal', icon: 'arrow-up-circle-outline' },
  ADJUSTMENT: { label: 'Admin Adjustment', icon: 'swap-horizontal-outline' },
};

const ICON_WRAPPER_SIZE = 40;

export function TransactionRow({ type, amount, createdAt, statusLabel, statusVariant }: TransactionRowProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const meta = TYPE_META[type];
  const isPositive = amount >= 0;

  return (
    <View style={styles.row}>
      <IconBadge icon={meta.icon} size={ICON_WRAPPER_SIZE} style={styles.iconWrapper} />
      <View style={styles.details}>
        <AppText variant="bodyMedium">{meta.label}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {formatDateTime(createdAt)}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <AppText variant="bodySemibold" color={isPositive ? colors.positive : colors.negative}>
          {isPositive ? '+' : ''}
          {formatCurrency(amount)}
        </AppText>
        {statusLabel && <Badge label={statusLabel} status={statusVariant} />}
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    iconWrapper: {
      marginRight: spacing.md,
    },
    details: {
      flex: 1,
      gap: spacing.xxs,
    },
    trailing: {
      alignItems: 'flex-end',
      gap: spacing.xxs,
    },
  });
