import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppButton, AppText, Header, Screen, TextField } from '@components/common';
import { ApiError } from '@/api/client';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { createWalletRequest } from '@services/walletService';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export function CreateRequestScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const numericAmount = Number(amount.replace(/[^0-9]/g, ''));
  const canSubmit = numericAmount > 0 && reason.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(undefined);
    setSubmitting(true);
    try {
      await createWalletRequest('INCREASE', numericAmount, reason.trim());
      navigation.replace('PermissionRequests');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title="Create Request" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TextField
          label="Amount"
          icon="cash-outline"
          placeholder="0"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextField label="Reason" placeholder="Why is this request needed?" value={reason} onChangeText={setReason} />

        {error && (
          <AppText variant="caption" color={colors.negative} align="center">
            {error}
          </AppText>
        )}

        <AppButton
          label="Submit Request"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          fullWidth
          size="lg"
          style={styles.submit}
        />
        <AppText variant="caption" color={colors.textMuted} align="center">
          Your request will be reviewed by an admin.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
