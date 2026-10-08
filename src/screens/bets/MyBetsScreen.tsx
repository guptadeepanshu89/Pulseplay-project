import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppTopBar, EmptyState, FilterTabs, RefreshableScrollView, Screen, SkeletonList } from '@components/common';
import { BetCard } from '@components/bet/BetCard';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useLoadOnMount } from '@hooks/useLoadOnMount';
import { getAllBets } from '@services/betService';
import { Bet, BetStatus } from '@/types/bet';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterKey = 'ALL' | BetStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'WON', label: 'Won' },
  { key: 'LOST', label: 'Lost' },
  { key: 'VOID', label: 'Void' },
];

const SKELETON_CARD_HEIGHT = 100;
const SKELETON_COUNT = 4;

export function MyBetsScreen() {
  const navigation = useNavigation<Nav>();
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const result = await getAllBets();
    setBets(result);
    setLoading(false);
  }, []);

  useLoadOnMount(loadData);

  const filtered = useMemo(
    () => (filter === 'ALL' ? bets : bets.filter((bet) => bet.status === filter)),
    [bets, filter],
  );

  return (
    <Screen>
      <AppTopBar />
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={SKELETON_COUNT} itemHeight={SKELETON_CARD_HEIGHT} gap={spacing.md} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState icon="ticket-outline" title="No bets" message="No bets match this filter." />
      ) : (
        <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.content}>
          {filtered.map((bet) => (
            <BetCard key={bet.id} bet={bet} onPress={() => navigation.navigate('BetDetail', { betId: bet.id })} />
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
