import { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@context/ThemeContext';
import { AuthProvider, useAuth } from '@context/AuthContext';
import { WalletProvider } from '@context/WalletContext';
import { BetSlipProvider } from '@context/BetSlipContext';
import { NotificationProvider } from '@context/NotificationContext';
import { RootNavigator } from '@navigation/RootNavigator';

// Wallet/BetSlip/Notification fetch on mount — skip until the user is fully
// allowed in (authenticated AND past mandatory password change). Otherwise a
// temp-password session 403s those APIs and can disrupt the Change Password gate.
function AuthenticatedProviders({ children }: PropsWithChildren) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || user?.mustChangePassword) {
    return <>{children}</>;
  }

  return (
    <WalletProvider>
      <BetSlipProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </BetSlipProvider>
    </WalletProvider>
  );
}

function AppContent() {
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <AuthProvider>
        <AuthenticatedProviders>
          <RootNavigator />
        </AuthenticatedProviders>
      </AuthProvider>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
