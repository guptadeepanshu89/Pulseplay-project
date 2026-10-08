import { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@context/ThemeContext';
import { AuthProvider, useAuth } from '@context/AuthContext';
import { WalletProvider } from '@context/WalletContext';
import { BetSlipProvider } from '@context/BetSlipContext';
import { NotificationProvider } from '@context/NotificationContext';
import { RootNavigator } from '@navigation/RootNavigator';

// Wallet/BetSlip/Notification data only means anything once logged in, and each
// fetches on mount — mounting them before auth resolves would fire an
// unauthenticated request that's guaranteed to 401. Only mount them once
// isAuthenticated is actually true.
function AuthenticatedProviders({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
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
