import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AppText, Header, IconButton, Screen, Skeleton, Touchable } from '@components/common';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { LineChart } from '@components/charts/LineChart';
import { radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getEventById } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { currentConnectionState, useLiveRefresh } from '@/realtime/live';
import { applyCryptoSpot, mergeCryptoHistory } from '@/realtime/providerUpdates';
import { getCryptoPriceHistory } from '@services/cryptoService';
import { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';
import { formatUsd } from '@utils/formatCurrency';
import { formatDateTime } from '@utils/formatDate';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CryptoDetail'>;

const TIMEFRAMES: ChartTimeframe[] = ['24H', '1W', '1M', '1Y', 'ALL'];
const CHART_HEIGHT = 180;
const CHART_HORIZONTAL_PADDING = layout.screenPaddingHorizontal * 2;
const DEFAULT_SYMBOL = 'BTC';
export function CryptoDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('24H');
  const [watchlisted, setWatchlisted] = useState(false);
  const [priceHistory, setPriceHistory] = useState<CryptoPriceHistory | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const loadMarkets = useCallback(() => {
    return getMarketsByEventId(eventId)
      .then((next) => {
        setMarkets(next);
        setMarketsError(null);
      })
      .catch((error: unknown) => {
        setMarketsError(error instanceof ApiError ? error.message : 'Could not load markets');
      })
      .finally(() => setMarketsLoading(false));
  }, [eventId]);

  useEffect(() => {
    getEventById(eventId).then((result) => setEvent(result ?? null));
    void loadMarkets();
  }, [eventId, loadMarkets]);

  const symbol = event?.symbol ?? DEFAULT_SYMBOL;
  const marketIds = markets.map((market) => market.id);

  const loadPrice = useCallback(() => {
    if (!event) return;
    getCryptoPriceHistory(symbol, timeframe)
      .then((history) => {
        setPriceHistory((current) => mergeCryptoHistory(current, history));
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setPriceHistory((current) => (current ? { ...current, stale: true } : current));
      });
  }, [event, symbol, timeframe]);


  useFocusEffect(
    useCallback(() => {
      if (!event) return undefined;
      loadPrice();
      const appSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          loadPrice();
          loadMarkets();
        }
      });
      return () => {
        appSub.remove();
      };
    }, [event, loadMarkets, loadPrice]),
  );

  useLiveRefresh(() => {
    if (currentConnectionState() === 'connected') return;
    loadPrice();
    loadMarkets();
  }, marketIds, undefined, (event) => {
    if (event.type !== 'crypto.updated') return false;
    setPriceHistory((current) => applyCryptoSpot(current, event, symbol));
    return true;
  });

  const handleSelectTimeframe = (next: ChartTimeframe) => {
    setTimeframe(next);
    setChartLoading(true);
  };

  // currentPrice/changePercent come straight from the backend, which can use a
  // real 24h change from the price source — a client-side first-vs-last-point
  // computation would be wrong whenever our own local history is shorter than
  // the requested window.
  const latestPrice = priceHistory?.currentPrice ?? 0;
  const changePercent = priceHistory?.changePercent ?? 0;
  const isPositive = changePercent >= 0;
  const hasPrice = latestPrice > 0 || (priceHistory?.points.length ?? 0) > 0;
  const priceIsStale = priceHistory?.stale === true;
  const chartWidth = Dimensions.get('window').width - CHART_HORIZONTAL_PADDING;

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection || !event || market.status !== 'OPEN') return;
    toggleSelection({
      eventId: event.id,
      eventName: event.name,
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
      <Header
        title={event?.name ?? 'Bitcoin (BTC)'}
        subtitle={`${symbol}/USD`}
        onBack={navigation.goBack}
        right={
          <IconButton
            name={watchlisted ? 'star' : 'star-outline'}
            color={watchlisted ? colors.warning : undefined}
            onPress={() => setWatchlisted((current) => !current)}
            accessibilityLabel={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {chartLoading ? (
          <>
            <Skeleton width="60%" height={40} style={styles.skeletonSpacing} />
            <Skeleton width="100%" height={CHART_HEIGHT} style={styles.skeletonSpacing} />
          </>
        ) : !hasPrice ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.sectionTitle}>
            Price unavailable
          </AppText>
        ) : (
          <>
            <View style={styles.priceRow}>
              <AppText variant="display">{formatUsd(latestPrice)}</AppText>
              {priceIsStale && (
                <AppText variant="caption" color={colors.textMuted}>
                  Price delayed — showing the last known value
                </AppText>
              )}
              <View
                style={[styles.changeBadge, { backgroundColor: isPositive ? colors.positiveMuted : colors.negativeMuted }]}
              >
                <Ionicons
                  name={isPositive ? 'trending-up' : 'trending-down'}
                  size={layout.iconSizeSmall}
                  color={isPositive ? colors.positive : colors.negative}
                />
                <AppText variant="captionMedium" color={isPositive ? colors.positive : colors.negative}>
                  {isPositive ? '+' : ''}
                  {changePercent.toFixed(2)}% ({timeframe})
                </AppText>
              </View>
            </View>

            <View style={styles.timeframeRow}>
              {TIMEFRAMES.map((item) => {
                const active = item === timeframe;
                return (
                  <Touchable key={item} onPress={() => handleSelectTimeframe(item)} style={styles.timeframeItem}>
                    <AppText variant="captionMedium" color={active ? colors.accent : colors.textMuted}>
                      {item}
                    </AppText>
                  </Touchable>
                );
              })}
            </View>

            <View style={styles.chartWrapper}>
              <LineChart data={priceHistory?.points ?? []} width={chartWidth} height={CHART_HEIGHT} positive={isPositive} />
            </View>
          </>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>
          Market Predictions
        </AppText>
        {marketsLoading ? (
          <Skeleton width="100%" height={120} style={styles.skeletonSpacing} />
        ) : marketsError ? (
          <AppText variant="body" color={colors.negative} style={styles.sectionTitle}>
            {marketsError}
          </AppText>
        ) : markets.length === 0 ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.sectionTitle}>
            No active markets available.
          </AppText>
        ) : (
          markets.map((market) => (
            <View key={market.id}>
              <AppText variant="caption" color={colors.textMuted} style={styles.marketMeta}>
                {market.status}
                {event?.startTime ? ` · ${formatDateTime(event.startTime)}` : ''}
              </AppText>
              <MarketOddsCard
                market={market}
                fullWidth
                onPressSelection={(selectionId) => handleSelect(market, selectionId)}
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
  skeletonSpacing: {
    marginBottom: spacing.lg,
  },
  priceRow: {
    marginBottom: spacing.md,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  timeframeItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chartWrapper: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  marketMeta: {
    marginBottom: spacing.xs,
  },
});
