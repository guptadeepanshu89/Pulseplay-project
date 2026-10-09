import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Header, IconBadge, Screen, TextField } from '@components/common';
import { ApiError } from '@/api/client';
import { useTheme } from '@context/ThemeContext';
import { forgotPassword, resetPassword } from '@services/authService';
import { ColorPalette, spacing } from '@theme';
import { emailOrMobileError, passwordError } from '@utils/validation';
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
  const [formError, setFormError] = useState<string | undefined>();
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | undefined>();

  const error = touched ? emailOrMobileError(identifier) : undefined;
  const canSubmit = !emailOrMobileError(identifier) && !submitting;
  const canReset = resetToken.trim().length > 0 && !passwordError(newPassword) && !resetting;

  const handleSubmit = async () => {
    setTouched(true);
    setFormError(undefined);
    if (emailOrMobileError(identifier)) return;
    setSubmitting(true);
    try {
      await forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setResetError(undefined);
    if (!canReset) return;
    setResetting(true);
    try {
      await resetPassword(resetToken.trim(), newPassword);
      setResetDone(true);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  if (sent && resetDone) {
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
            Password Updated
          </AppText>
          <AppText variant="body" color={colors.textSecondary} align="center" style={styles.successBody}>
            You can now log in with your new password.
          </AppText>
          <AppButton label="Back to Log In" onPress={navigation.goBack} fullWidth size="lg" />
        </View>
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <Header title="Reset Password" onBack={navigation.goBack} />
        <View style={styles.content}>
          <IconBadge
            icon="checkmark"
            size={SUCCESS_ICON_SIZE}
            iconSize={SUCCESS_GLYPH_SIZE}
            color={colors.white}
            backgroundColor={colors.positive}
            style={styles.successIcon}
          />
          <AppText variant="h2" align="center" style={styles.successTitle}>
            Reset Request Received
          </AppText>
          <AppText variant="body" color={colors.textSecondary} align="center" style={styles.successBody}>
            If an account exists for {identifier.trim()}, a reset code was issued. Enter the code and a new
            password below. (Email/SMS delivery is not configured — ask an admin for the code from server
            logs.)
          </AppText>
          <TextField
            label="Reset Code"
            icon="key-outline"
            placeholder="Paste reset code"
            autoCapitalize="none"
            value={resetToken}
            onChangeText={setResetToken}
          />
          <TextField
            label="New Password"
            icon="lock-closed-outline"
            placeholder="At least 10 characters"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            error={newPassword ? passwordError(newPassword) : undefined}
          />
          {resetError && (
            <AppText variant="caption" color={colors.negative} align="center">
              {resetError}
            </AppText>
          )}
          <AppButton
            label="Set New Password"
            onPress={handleReset}
            disabled={!canReset}
            loading={resetting}
            fullWidth
            size="lg"
          />
          <AppButton label="Back to Log In" onPress={navigation.goBack} fullWidth size="lg" variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Reset Password" onBack={navigation.goBack} />
      <View style={styles.content}>
        <AppText variant="body" color={colors.textSecondary} style={styles.description}>
          Enter the email or mobile number linked to your account and we&apos;ll issue a reset code.
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
        {formError && (
          <AppText variant="caption" color={colors.negative} align="center">
            {formError}
          </AppText>
        )}
        <AppButton
          label="Send Reset Code"
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
      alignSelf: 'center',
    },
    successTitle: {
      marginBottom: spacing.xs,
    },
    successBody: {
      marginBottom: spacing.xl,
    },
  });
