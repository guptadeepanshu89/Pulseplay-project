import { StyleSheet, View } from 'react-native';

import { ColorPalette, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import { formatCurrency } from '@utils/formatCurrency';
import { formatDateTime } from '@utils/formatDate';
import { WalletRequest } from '@/types/wallet';

import { AppText, Badge, Card } from '@components/common';
import type { BadgeStatus } from '@components/common';

interface RequestCardProps {
  request: WalletRequest;
}

const STATUS_BADGE: Record<WalletRequest['status'], BadgeStatus> = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export function RequestCard({ request }: RequestCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isIncrease = request.type === 'INCREASE';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="bodySemibold">
          {isIncrease ? 'Increase Balance' : 'Decrease Balance'}
        </AppText>
        <Badge label={request.status} status={STATUS_BADGE[request.status]} />
      </View>
      <AppText variant="h2" color={isIncrease ? colors.positive : colors.negative} style={styles.amount}>
        {isIncrease ? '+' : '-'}
        {formatCurrency(request.amount)}
      </AppText>
      <AppText variant="body" color={colors.textSecondary}>
        Reason: {request.reason}
      </AppText>
      <AppText variant="caption" color={colors.textMuted} style={styles.date}>
        Requested: {formatDateTime(request.requestedAt)}
      </AppText>
    </Card>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    amount: {
      marginBottom: spacing.sm,
    },
    date: {
      marginTop: spacing.xs,
    },
  });
