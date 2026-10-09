import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Header, IconButton, Screen, Skeleton, Touchable } from '@components/common';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { LineChart } from '@components/charts/LineChart';
import { radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getEventById } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { getCryptoPriceHistory } from '@services/cryptoService';
import { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';
import { formatUsd } from '@utils/formatCurrency';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CryptoDetail'>;

const TIMEFRAMES: ChartTimeframe[] = ['24H', '1W', '1M', '1Y', 'ALL'];
const CHART_HEIGHT = 180;
const CHART_HORIZONTAL_PADDING = layout.screenPaddingHorizontal * 2;
const DEFAULT_SYMBOL = 'BTC';
const PRICE_REFRESH_MS = 10000;

export function CryptoDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('24H');
  const [watchlisted, setWatchlisted] = useState(false);
  const [priceHistory, setPriceHistory] = useState<CryptoPriceHistory | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    getEventById(eventId).then((result) => setEvent(result ?? null));
    getMarketsByEventId(eventId).then(setMarkets);
  }, [eventId]);

  const symbol = event?.symbol ?? DEFAULT_SYMBOL;

  useFocusEffect(
    useCallback(() => {
      if (!event) return undefined;
      let active = true;
      const load = () => {
        getCryptoPriceHistory(symbol, timeframe)
          .then((history) => {
            if (!active) return;
            setPriceHistory(history);
            setChartLoading(false);
          })
          .catch(() => {
            if (active) setChartLoading(false);
          });
      };
      load();
      const timer = setInterval(load, PRICE_REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [event, symbol, timeframe]),
  );

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
  const chartWidth = Dimensions.get('window').width - CHART_HORIZONTAL_PADDING;

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection || !event) return;
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
        ) : (
          <>
            <View style={styles.priceRow}>
              <AppText variant="display">{formatUsd(latestPrice)}</AppText>
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
        {markets.map((market) => (
          <MarketOddsCard
            key={market.id}
            market={market}
            fullWidth
            onPressSelection={(selectionId) => handleSelect(market, selectionId)}
          />
        ))}
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
});
