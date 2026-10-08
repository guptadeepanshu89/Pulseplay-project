import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Header, IconBadge, Screen, TextField } from '@components/common';
import { useTheme } from '@context/ThemeContext';
import { ColorPalette, spacing } from '@theme';
import { emailOrMobileError } from '@utils/validation';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const SUCCESS_ICON_SIZE = 72;
const SUCCESS_GLYPH_SIZE = 40;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const error = touched ? emailOrMobileError(identifier) : undefined;
  const canSubmit = !emailOrMobileError(identifier) && !submitting;

  const handleSubmit = () => {
    setTouched(true);
    if (emailOrMobileError(identifier)) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
    }, 600);
  };

  if (sent) {
    return (
      <Screen>
        <Header title="Reset Password" onBack={navigation.goBack} />
        <View style={styles.successContent}>
          <IconBadge
            icon="checkmark"
            size={SUCCESS_ICON_SIZE}
            iconSize={SUCCESS_GLYPH_SIZE}
            color={colors.white}
            backgroundColor={colors.positive}
            style={styles.successIcon}
          />
          <AppText variant="h2" align="center" style={styles.successTitle}>
            Reset Link Sent
          </AppText>
          <AppText variant="body" color={colors.textSecondary} align="center" style={styles.successBody}>
            If an account exists for {identifier.trim()}, we&apos;ve sent instructions to reset your password.
          </AppText>
          <AppButton label="Back to Log In" onPress={navigation.goBack} fullWidth size="lg" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Reset Password" onBack={navigation.goBack} />
      <View style={styles.content}>
        <AppText variant="body" color={colors.textSecondary} style={styles.description}>
          Enter the email or mobile number linked to your account and we&apos;ll send you a link to reset your
          password.
        </AppText>
        <TextField
          label="Email or Mobile Number"
          icon="person-outline"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
          onBlur={() => setTouched(true)}
          error={error}
        />
        <AppButton
          label="Send Reset Link"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          fullWidth
          size="lg"
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      padding: spacing.xxl,
      gap: spacing.lg,
    },
    description: {
      marginBottom: spacing.sm,
    },
    submit: {
      marginTop: spacing.sm,
    },
    successContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    successIcon: {
      marginBottom: spacing.sm,
    },
    successTitle: {
      marginBottom: spacing.xs,
    },
    successBody: {
      marginBottom: spacing.xl,
    },
  });
