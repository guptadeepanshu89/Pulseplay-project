import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, IconBadge, Screen, TextField, Touchable } from '@components/common';
import { useAuth } from '@context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { ColorPalette, radius, spacing } from '@theme';
import { emailOrMobileError, passwordError } from '@utils/validation';
import { readableErrorMessage } from '@/api/errorMessage';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LOGO_SIZE = 72;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  const identifierErrorText = emailOrMobileError(identifier);
  const passwordErrorText = passwordError(password);
  const canSubmit = !identifierErrorText && !passwordErrorText && !submitting;

  const handleLogin = async () => {
    setIdentifierTouched(true);
    setPasswordTouched(true);
    setAuthError(undefined);
    if (identifierErrorText || passwordErrorText) return;
    setSubmitting(true);
    const result = await login(identifier.trim(), password);
    setSubmitting(false);
    if (!result.success) {
      setAuthError(readableErrorMessage(result.error, 'Something went wrong. Please try again.'));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.brand}>
            <IconBadge icon="pulse" size={LOGO_SIZE} borderRadius={radius.xl} style={styles.logo} />
            <AppText variant="h1" style={styles.appName}>
              PulsePlay
            </AppText>
            <AppText variant="body" color={colors.textSecondary} align="center">
              Live markets. Real-time predictions.
            </AppText>
          </View>

          <Card style={styles.form}>
            <TextField
              label="Email or Mobile Number"
              icon="person-outline"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={identifier}
              onChangeText={setIdentifier}
              onBlur={() => setIdentifierTouched(true)}
              error={identifierTouched ? identifierErrorText : undefined}
            />
            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onBlur={() => setPasswordTouched(true)}
              error={passwordTouched ? passwordErrorText : undefined}
            />
            <Touchable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotWrapper}
            >
              <AppText variant="captionMedium" color={colors.accent} align="right">
                Forgot Password?
              </AppText>
            </Touchable>
            {authError && (
              <AppText variant="caption" color={colors.negative} align="center">
                {authError}
              </AppText>
            )}
            <AppButton
              label="Log In"
              onPress={handleLogin}
              disabled={!canSubmit}
              loading={submitting}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </Card>

          <AppText variant="caption" color={colors.textMuted} align="center" style={styles.footer}>
            This app uses virtual currency for entertainment purposes only.{'\n'}No real money is involved.
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      gap: spacing.xxxl,
    },
    brand: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    logo: {
      marginBottom: spacing.sm,
    },
    appName: {
      letterSpacing: 0.5,
    },
    form: {
      gap: spacing.lg,
    },
    forgotWrapper: {
      marginTop: -spacing.sm,
    },
    submit: {
      marginTop: spacing.sm,
    },
    footer: {
      position: 'absolute',
      bottom: spacing.xxl,
      left: 0,
      right: 0,
    },
  });
