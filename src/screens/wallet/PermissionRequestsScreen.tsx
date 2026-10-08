import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, FilterTabs, Header, RefreshableScrollView, Screen, SkeletonList } from '@components/common';
import { RequestCard } from '@components/wallet/RequestCard';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useLoadOnMount } from '@hooks/useLoadOnMount';
import { getWalletRequests } from '@services/walletService';
import { WalletRequest } from '@/types/wallet';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PermissionRequests'>;

type FilterKey = 'ALL' | WalletRequest['status'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const SKELETON_CARD_HEIGHT = 128;
const SKELETON_COUNT = 3;

export function PermissionRequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const result = await getWalletRequests();
    setRequests(result);
    setLoading(false);
  }, []);

  useLoadOnMount(loadData);

  const filtered = useMemo(
    () => (filter === 'ALL' ? requests : requests.filter((request) => request.status === filter)),
    [requests, filter],
  );

  return (
    <Screen>
      <Header title="Permission Requests" onBack={navigation.goBack} />
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={SKELETON_COUNT} itemHeight={SKELETON_CARD_HEIGHT} gap={spacing.md} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No requests" message="No requests match this filter." />
      ) : (
        <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.content}>
          {filtered.map((request) => (
            <RequestCard key={request.id} request={request} />
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
