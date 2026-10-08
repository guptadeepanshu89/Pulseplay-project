import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, IconBadge, Screen } from '@components/common';
import { SummaryRow } from '@components/bet/SummaryRow';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { formatCurrency } from '@utils/formatCurrency';
import { formatOdds } from '@utils/formatOdds';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BetConfirmation'>;

const SUCCESS_ICON_SIZE = 88;
const SUCCESS_GLYPH_SIZE = 56;

export function BetConfirmationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { lastPlacedBet } = useBetSlip();

  if (!lastPlacedBet) {
    return (
      <Screen style={styles.emptyState}>
        <AppText variant="h2">No bet to show</AppText>
        <AppButton label="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successHeader}>
          <IconBadge
            icon="checkmark"
            size={SUCCESS_ICON_SIZE}
            iconSize={SUCCESS_GLYPH_SIZE}
            color={colors.white}
            backgroundColor={colors.positive}
            style={styles.successIcon}
          />
          <AppText variant="h1" style={styles.successTitle}>
            Bet Placed Successfully!
          </AppText>
          <AppText variant="body" color={colors.textSecondary} align="center">
            Your bets have been placed.
          </AppText>
        </View>

        <Card style={styles.summaryCard}>
          <SummaryRow label="Total Odds" value={formatOdds(lastPlacedBet.combinedOdds)} valueColor={colors.textPrimary} />
          <SummaryRow label="Stake" value={formatCurrency(lastPlacedBet.stake)} valueColor={colors.textPrimary} />
          <SummaryRow
            label="Potential Return"
            value={formatCurrency(lastPlacedBet.potentialReturn)}
            valueColor={colors.positive}
            emphasize
          />
        </Card>

        <AppText variant="h3" style={styles.detailsTitle}>
          Bet Details
        </AppText>
        <Card style={styles.legsCard}>
          {lastPlacedBet.selections.map((leg, index) => (
            <View key={leg.selectionId} style={styles.legRow}>
              <AppText variant="bodyMedium" style={styles.legText} numberOfLines={1}>
                {index + 1}. {leg.selectionName} &middot; {leg.marketName}
              </AppText>
              <AppText variant="bodySemibold" color={colors.accent}>
                {formatOdds(leg.oddsAtPlacement)}
              </AppText>
            </View>
          ))}
        </Card>

        <AppButton
          label="View My Bets"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
          fullWidth
          size="lg"
          style={styles.viewBetsButton}
        />
        <AppButton
          label="Done"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          variant="secondary"
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.xxxl,
    },
    successHeader: {
      alignItems: 'center',
      marginTop: spacing.xxl,
      marginBottom: spacing.xxl,
      gap: spacing.sm,
    },
    successIcon: {
      marginBottom: spacing.md,
    },
    successTitle: {
      textAlign: 'center',
    },
    summaryCard: {
      marginBottom: spacing.xl,
    },
    detailsTitle: {
      marginBottom: spacing.md,
    },
    legsCard: {
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    legText: {
      flex: 1,
      marginRight: spacing.sm,
    },
    viewBetsButton: {
      marginBottom: spacing.md,
    },
  });
