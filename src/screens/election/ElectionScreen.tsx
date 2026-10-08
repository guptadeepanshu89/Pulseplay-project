import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText, Card, Header, Screen } from '@components/common';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getEventsByCategory } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { formatLongDate } from '@utils/formatDate';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Election'>;

export function ElectionScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    getEventsByCategory('ELECTION').then((events) => {
      const first = events[0] ?? null;
      setEvent(first);
      if (first) {
        getMarketsByEventId(first.id).then(setMarkets);
      }
    });
  }, []);

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
      <Header title="Election" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {event && (
          <Card style={styles.eventCard}>
            <AppText variant="h2">{event.name}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.eventDate}>
              {formatLongDate(event.startTime)}
            </AppText>
          </Card>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>
          Top Markets
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  eventCard: {
    marginBottom: spacing.xl,
  },
  eventDate: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
});
