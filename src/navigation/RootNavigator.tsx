import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '@screens/auth/ForgotPasswordScreen';
import { MarketDetailScreen } from '@screens/markets/MarketDetailScreen';
import { CryptoDetailScreen } from '@screens/crypto/CryptoDetailScreen';
import { FootballScreen } from '@screens/football/FootballScreen';
import { ElectionScreen } from '@screens/election/ElectionScreen';
import { LiveMatchScreen } from '@screens/live/LiveMatchScreen';
import { BetSlipScreen } from '@screens/betslip/BetSlipScreen';
import { BetConfirmationScreen } from '@screens/betslip/BetConfirmationScreen';
import { WalletTransactionsScreen } from '@screens/wallet/WalletTransactionsScreen';
import { PermissionRequestsScreen } from '@screens/wallet/PermissionRequestsScreen';
import { CreateRequestScreen } from '@screens/wallet/CreateRequestScreen';
import { BetDetailScreen } from '@screens/bets/BetDetailScreen';
import { NotificationsScreen } from '@screens/notifications/NotificationsScreen';
import { PersonalInfoScreen } from '@screens/profile/PersonalInfoScreen';
import { ChangePasswordScreen } from '@screens/profile/ChangePasswordScreen';
import { HelpSupportScreen } from '@screens/profile/HelpSupportScreen';
import { AboutUsScreen } from '@screens/profile/AboutUsScreen';

import { BottomTabNavigator } from './BottomTabNavigator';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, booting, user } = useAuth();
  const { colors, scheme } = useTheme();
  const mustChangePassword = Boolean(user?.mustChangePassword);

  if (booting) {
    return (
      <View style={[styles.bootScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const navigationTheme: Theme = {
    ...(scheme === 'light' ? DefaultTheme : DarkTheme),
    colors: {
      ...(scheme === 'light' ? DefaultTheme.colors : DarkTheme.colors),
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      primary: colors.accent,
      text: colors.textPrimary,
    },
  };

  // Remount the stack when auth/password-gate mode changes so a prior MainTabs
  // session cannot stick around after a temp-password login.
  const navigatorKey = !isAuthenticated ? 'guest' : mustChangePassword ? 'must-change-password' : 'app';

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator key={navigatorKey} screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : mustChangePassword ? (
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="MarketDetail" component={MarketDetailScreen} />
            <Stack.Screen name="CryptoDetail" component={CryptoDetailScreen} />
            <Stack.Screen name="Football" component={FootballScreen} />
            <Stack.Screen name="Election" component={ElectionScreen} />
            <Stack.Screen name="LiveMatch" component={LiveMatchScreen} />
            <Stack.Screen name="BetSlip" component={BetSlipScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="BetConfirmation" component={BetConfirmationScreen} />
            <Stack.Screen name="WalletTransactions" component={WalletTransactionsScreen} />
            <Stack.Screen name="PermissionRequests" component={PermissionRequestsScreen} />
            <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
            <Stack.Screen name="BetDetail" component={BetDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="AboutUs" component={AboutUsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
