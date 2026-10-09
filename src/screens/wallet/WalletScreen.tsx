import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppTopBar,
  Card,
  EmptyState,
  NavRow,
  RefreshableScrollView,
  Screen,
  SectionHeader,
  Skeleton,
} from '@components/common';
import { BalanceCard } from '@components/wallet/BalanceCard';
import { TransactionRow } from '@components/wallet/TransactionRow';
import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { useWallet } from '@context/WalletContext';
import { getWalletRequests, getWalletTransactions } from '@services/walletService';
import { WalletRequest, WalletTransaction } from '@/types/wallet';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PREVIEW_LIMIT = 3;

export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { wallet, refresh: refreshWallet } = useWallet();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [transactionsResult, requestsResult] = await Promise.all([
      getWalletTransactions(),
      getWalletRequests(),
      refreshWallet(),
    ]);
    setTransactions(transactionsResult);
    setRequests(requestsResult);
    setLoading(false);
  }, [refreshWallet]);

  // Refresh balance when returning to Wallet (e.g. after admin fund approval).
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const pendingRequests = requests.filter((request) => request.status === 'PENDING');

  return (
    <Screen>
      <AppTopBar />
      {loading ? (
        <View style={styles.content}>
          <Skeleton width="100%" height={220} />
        </View>
      ) : (
        <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.content}>
          <BalanceCard
            availableBalance={wallet?.availableBalance ?? 0}
            lockedBalance={wallet?.lockedBalance ?? 0}
            onAddFunds={() => navigation.navigate('CreateRequest')}
          />

          <NavRow
            icon="receipt-outline"
            label="My Bets"
            onPress={() => navigation.navigate('MainTabs', { screen: 'MyBets' })}
            style={styles.myBetsRow}
          />

          <View style={styles.section}>
            <SectionHeader
              title="Recent Transactions"
              onSeeAll={() => navigation.navigate('WalletTransactions')}
            />
            <Card padding="none" style={styles.listCard}>
              {transactions.slice(0, PREVIEW_LIMIT).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  type={transaction.type}
                  amount={transaction.amount}
                  createdAt={transaction.createdAt}
                />
              ))}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader
              title="Pending Requests"
              onSeeAll={() => navigation.navigate('PermissionRequests')}
            />
            {pendingRequests.length === 0 ? (
              <EmptyState icon="hourglass-outline" title="No pending requests" />
            ) : (
              <Card padding="none" style={styles.listCard}>
                {pendingRequests.map((request) => (
                  <TransactionRow
                    key={request.id}
                    type={request.type === 'INCREASE' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT'}
                    amount={request.type === 'INCREASE' ? request.amount : -request.amount}
                    createdAt={request.requestedAt}
                    statusLabel={request.status}
                    statusVariant="PENDING"
                  />
                ))}
              </Card>
            )}
          </View>
        </RefreshableScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    myBetsRow: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      ...cardElevation(colors, scheme),
    },
    section: {
      marginTop: spacing.xl,
    },
    listCard: {
      paddingHorizontal: spacing.lg,
    },
  });
