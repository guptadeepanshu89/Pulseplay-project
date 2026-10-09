import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppButton, AppText, Header, Screen, TextField } from '@components/common';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useAuth } from '@context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { passwordError } from '@utils/validation';
import { RootStackParamList } from '@navigation/types';
import { ApiError, setToken } from '@/api/client';
import { changePassword } from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { user, markPasswordChanged } = useAuth();
  const mandatory = Boolean(user?.mustChangePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentError = touched && currentPassword.length === 0 ? 'Current password is required' : undefined;
  const newError = touched ? passwordError(newPassword) : undefined;
  const confirmError =
    touched && confirmPassword !== newPassword ? 'Passwords do not match' : undefined;

  const canSubmit =
    currentPassword.length > 0 &&
    !passwordError(newPassword) &&
    confirmPassword === newPassword &&
    !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    setError(null);
    if (
      currentPassword.length === 0 ||
      passwordError(newPassword) ||
      confirmPassword !== newPassword ||
      submitting
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.token) await setToken(result.token);
      markPasswordChanged();
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched(false);
      if (!mandatory) navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title="Change Password" onBack={mandatory ? undefined : navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mandatory && (
          <AppText variant="body" color={colors.textSecondary}>
            You're signed in with a temporary password. Choose your own password to continue.
          </AppText>
        )}
        <TextField
          label="Current Password"
          icon="lock-closed-outline"
          secureTextEntry
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setSuccess(false);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          error={currentError}
        />
        <TextField
          label="New Password"
          icon="key-outline"
          secureTextEntry
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setSuccess(false);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          error={newError}
        />
        <TextField
          label="Confirm New Password"
          icon="key-outline"
          secureTextEntry
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setSuccess(false);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          error={confirmError}
        />

        <AppButton
          label="Update Password"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          fullWidth
          size="lg"
          style={styles.submit}
        />
        {error && (
          <AppText variant="caption" color={colors.negative} align="center">
            {error}
          </AppText>
        )}
        {success && !mandatory && (
          <AppText variant="caption" color={colors.positive} align="center">
            Your password has been updated.
          </AppText>
        )}
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
