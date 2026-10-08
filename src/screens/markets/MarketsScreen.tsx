import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppTopBar,
  FilterTabs,
  HorizontalCardRow,
  RefreshableScrollView,
  Screen,
  SectionHeader,
} from '@components/common';
import { EventCard, EVENT_CARD_HEIGHT } from '@components/market/EventCard';
import { EventsMarketsLoadingSkeleton } from '@components/market/EventsMarketsLoadingSkeleton';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useLoadOnMount } from '@hooks/useLoadOnMount';
import { getEvents } from '@services/eventService';
import { getMarkets } from '@services/marketService';
import { EventCategory, MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterKey = 'ALL' | EventCategory;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CRICKET', label: 'Cricket' },
  { key: 'FOOTBALL', label: 'Football' },
  { key: 'CRYPTO', label: 'Crypto' },
  { key: 'ELECTION', label: 'Election' },
];

export function MarketsScreen() {
  const navigation = useNavigation<Nav>();
  const { toggleSelection } = useBetSlip();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [eventsResult, marketsResult] = await Promise.all([getEvents(), getMarkets()]);
    setEvents(eventsResult);
    setMarkets(marketsResult);
    setLoading(false);
  }, []);

  useLoadOnMount(loadData);

  const filteredEvents = useMemo(
    () => (filter === 'ALL' ? events : events.filter((event) => event.category === filter)),
    [events, filter],
  );

  const filteredMarkets = useMemo(() => {
    const eventIds = new Set(filteredEvents.map((event) => event.id));
    return markets.filter((market) => eventIds.has(market.eventId));
  }, [markets, filteredEvents]);

  const eventNameFor = (eventId: number) => events.find((event) => event.id === eventId)?.name;

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection) return;
    toggleSelection({
      eventId: market.eventId,
      eventName: eventNameFor(market.eventId) ?? market.name,
      marketId: market.id,
      marketName: market.name,
      selectionId: selection.id,
      selectionName: selection.name,
      price: selection.currentPrice,
    });
    navigation.navigate('BetSlip');
  };

  return (
    <Screen>
      <AppTopBar />

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.scrollContent}>
          <EventsMarketsLoadingSkeleton />
        </View>
      ) : (
        <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.scrollContent}>
          <SectionHeader title="Live & Upcoming" />
          <HorizontalCardRow cardHeight={EVENT_CARD_HEIGHT}>
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() =>
                  event.category === 'CRYPTO'
                    ? navigation.navigate('CryptoDetail', { eventId: event.id })
                    : navigation.navigate('LiveMatch', { eventId: event.id })
                }
              />
            ))}
          </HorizontalCardRow>

          <SectionHeader title="Popular Markets" />
          {filteredMarkets.map((market) => (
            <MarketOddsCard
              key={market.id}
              market={market}
              eventName={eventNameFor(market.eventId)}
              fullWidth
              onPressSelection={(selectionId) => handleSelect(market, selectionId)}
              onPressCard={() => navigation.navigate('MarketDetail', { marketId: market.id })}
            />
          ))}
        </RefreshableScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
});
