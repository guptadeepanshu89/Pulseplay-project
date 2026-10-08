import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, EmptyState, Header, Screen } from '@components/common';
import { BetSlipItem } from '@components/bet/BetSlipItem';
import { StakeInput } from '@components/bet/StakeInput';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { useWallet } from '@context/WalletContext';
import { formatCurrency } from '@utils/formatCurrency';
import { formatOdds } from '@utils/formatOdds';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BetSlip'>;

export function BetSlipScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { selections, stake, setStake, removeSelection, totalOdds, potentialReturn, placeBet } =
    useBetSlip();
  const { wallet } = useWallet();
  const [submitting, setSubmitting] = useState(false);

  const availableBalance = wallet?.availableBalance ?? 0;
  const isValidStake = stake > 0 && stake <= availableBalance;
  const canSubmit = selections.length > 0 && isValidStake && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await placeBet();
    setSubmitting(false);
    navigation.replace('BetConfirmation');
  };

  return (
    <Screen>
      <Header
        title="Bet Slip"
        subtitle={`${selections.length} selection${selections.length === 1 ? '' : 's'}`}
        onBack={navigation.goBack}
      />

      {selections.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Your bet slip is empty"
          message="Tap on any odds to add a selection to your bet slip."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card padding="none" style={styles.selectionsCard}>
            {selections.map((selection) => (
              <BetSlipItem
                key={selection.selectionId}
                selection={selection}
                onRemove={() => removeSelection(selection.selectionId)}
              />
            ))}
          </Card>

          <View style={styles.totalOddsRow}>
            <AppText variant="bodyMedium" color={colors.textSecondary}>
              Total Odds
            </AppText>
            <AppText variant="h3" color={colors.accent}>
              {formatOdds(totalOdds)}
            </AppText>
          </View>

          <AppText variant="captionMedium" color={colors.textSecondary} style={styles.stakeLabel}>
            Stake
          </AppText>
          <StakeInput value={stake} onChange={setStake} />

          {!isValidStake && stake > availableBalance && (
            <AppText variant="caption" color={colors.negative} style={styles.stakeError}>
              Stake exceeds available balance ({formatCurrency(availableBalance)})
            </AppText>
          )}

          <View style={styles.returnRow}>
            <AppText variant="bodyMedium" color={colors.textSecondary}>
              Potential Return
            </AppText>
            <AppText variant="h2" color={colors.positive}>
              {formatCurrency(potentialReturn)}
            </AppText>
          </View>

          <AppButton
            label="Place Bet"
            onPress={handleConfirm}
            disabled={!canSubmit}
            loading={submitting}
            fullWidth
            size="lg"
            style={styles.placeBetButton}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.xxxl,
    },
    selectionsCard: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    totalOddsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    stakeLabel: {
      marginBottom: spacing.sm,
    },
    stakeError: {
      marginTop: spacing.sm,
    },
    returnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
    },
    placeBetButton: {
      marginBottom: spacing.xl,
    },
  });
