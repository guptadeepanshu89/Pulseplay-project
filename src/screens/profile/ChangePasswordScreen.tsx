import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppButton, AppText, Header, Screen, TextField } from '@components/common';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { passwordError } from '@utils/validation';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const currentError = touched && currentPassword.length === 0 ? 'Current password is required' : undefined;
  const newError = touched ? passwordError(newPassword) : undefined;
  const confirmError =
    touched && confirmPassword !== newPassword ? 'Passwords do not match' : undefined;

  const canSubmit =
    currentPassword.length > 0 &&
    !passwordError(newPassword) &&
    confirmPassword === newPassword &&
    !submitting;

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched(false);
    }, 600);
  };

  return (
    <Screen>
      <Header title="Change Password" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TextField
          label="Current Password"
          icon="lock-closed-outline"
          secureTextEntry
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setSuccess(false);
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
        {success && (
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
