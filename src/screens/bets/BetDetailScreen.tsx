import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Header, Screen, Skeleton } from '@components/common';
import { SummaryRow } from '@components/bet/SummaryRow';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { getBetById } from '@services/betService';
import { formatCurrency } from '@utils/formatCurrency';
import { formatOdds } from '@utils/formatOdds';
import { formatDateTime } from '@utils/formatDate';
import { Bet, BET_STATUS_BADGE } from '@/types/bet';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BetDetail'>;

const SKELETON_HEIGHT = 200;

export function BetDetailScreen({ route, navigation }: Props) {
  const { betId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [bet, setBet] = useState<Bet | null | undefined>(undefined);

  useEffect(() => {
    getBetById(betId).then((result) => setBet(result ?? null));
  }, [betId]);

  if (bet === undefined) {
    return (
      <Screen>
        <Header title="Bet Details" onBack={navigation.goBack} />
        <View style={styles.content}>
          <Skeleton width="100%" height={SKELETON_HEIGHT} />
        </View>
      </Screen>
    );
  }

  if (bet === null) {
    return (
      <Screen>
        <Header title="Bet Details" onBack={navigation.goBack} />
        <View style={styles.emptyState}>
          <AppText variant="h2">Bet not found</AppText>
        </View>
      </Screen>
    );
  }

  const resultColor =
    bet.status === 'WON' ? colors.positive : bet.status === 'LOST' ? colors.negative : colors.textSecondary;
  const settlementAmount = bet.status === 'LOST' ? 0 : bet.status === 'VOID' ? bet.stake : bet.potentialReturn;

  return (
    <Screen>
      <Header title="Bet Details" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.idRow}>
          <AppText variant="caption" color={colors.textMuted}>
            Bet #{bet.id}
          </AppText>
          <Badge label={bet.status} status={BET_STATUS_BADGE[bet.status]} />
        </View>

        <Card style={styles.summaryCard}>
          <SummaryRow label="Stake" value={formatCurrency(bet.stake)} valueColor={colors.textPrimary} />
          <SummaryRow label="Combined Odds" value={formatOdds(bet.combinedOdds)} valueColor={colors.accent} />
          <SummaryRow
            label={bet.status === 'OPEN' ? 'Potential Return' : bet.status === 'LOST' ? 'Result' : 'Payout'}
            value={bet.status === 'LOST' ? 'Not Won' : formatCurrency(settlementAmount)}
            valueColor={resultColor}
            emphasize
          />
        </Card>

        <AppText variant="h3" style={styles.legsTitle}>
          Selections
        </AppText>
        <Card style={styles.legsCard}>
          {bet.selections.map((leg, index) => (
            <View key={leg.selectionId} style={styles.legRow}>
              <View style={styles.legDetails}>
                <AppText variant="bodySemibold">
                  {index + 1}. {leg.selectionName}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {leg.marketName} &middot; {leg.eventName}
                </AppText>
              </View>
              <AppText variant="bodySemibold" color={colors.accent}>
                {formatOdds(leg.oddsAtPlacement)}
              </AppText>
            </View>
          ))}
        </Card>

        <Card style={styles.timelineCard}>
          <SummaryRow label="Placed" value={formatDateTime(bet.placedAt)} valueColor={colors.textPrimary} />
          {bet.settledAt && (
            <SummaryRow label="Settled" value={formatDateTime(bet.settledAt)} valueColor={colors.textPrimary} />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.xxxl,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    idRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    summaryCard: {
      marginBottom: spacing.xl,
    },
    legsTitle: {
      marginBottom: spacing.md,
    },
    legsCard: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    legDetails: {
      flex: 1,
      marginRight: spacing.sm,
      gap: spacing.xxs,
    },
    timelineCard: {
      marginBottom: spacing.md,
    },
  });
