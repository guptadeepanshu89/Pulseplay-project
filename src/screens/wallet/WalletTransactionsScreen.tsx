import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, FilterTabs, Header, RefreshableScrollView, Screen, SkeletonList } from '@components/common';
import { TransactionRow } from '@components/wallet/TransactionRow';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useLoadOnMount } from '@hooks/useLoadOnMount';
import { getWalletTransactions } from '@services/walletService';
import { WalletTransaction } from '@/types/wallet';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletTransactions'>;

type FilterKey = 'ALL' | 'CREDIT' | 'DEBIT';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CREDIT', label: 'Credit' },
  { key: 'DEBIT', label: 'Debit' },
];

const SKELETON_ROW_HEIGHT = 64;
const SKELETON_COUNT = 5;

export function WalletTransactionsScreen({ navigation }: Props) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const result = await getWalletTransactions();
    setTransactions(result);
    setLoading(false);
  }, []);

  useLoadOnMount(loadData);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return transactions;
    return transactions.filter((transaction) =>
      filter === 'CREDIT' ? transaction.amount >= 0 : transaction.amount < 0,
    );
  }, [transactions, filter]);

  return (
    <Screen>
      <Header title="Wallet Transactions" onBack={navigation.goBack} />
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={SKELETON_COUNT} itemHeight={SKELETON_ROW_HEIGHT} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No transactions" message="Nothing to show for this filter yet." />
      ) : (
        <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.content}>
          {filtered.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              type={transaction.type}
              amount={transaction.amount}
              createdAt={transaction.createdAt}
              statusLabel="Completed"
              statusVariant="APPROVED"
            />
          ))}
        </RefreshableScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
});
