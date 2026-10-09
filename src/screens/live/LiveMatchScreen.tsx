import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Header, Screen } from '@components/common';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getEventById } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveMatch'>;

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TimelineEntry {
  minute: string;
  icon: IoniconName;
  iconColor: string;
  description: string;
}

// No live timeline feed exists in the backend — demo entries only, clearly labeled in UI.
function getDemoTimelineForEvent(event: MarketEvent, colors: ColorPalette): TimelineEntry[] {
  const home = event.homeTeam?.name ?? event.name;
  const away = event.awayTeam?.name ?? '';
  return [
    { minute: "56'", icon: 'football', iconColor: colors.positive, description: `Goal! ${home} scores` },
    { minute: "53'", icon: 'square', iconColor: colors.warning, description: `Yellow Card - ${away}` },
    { minute: "49'", icon: 'flag', iconColor: colors.textSecondary, description: `Corner - ${home}` },
    { minute: "45'", icon: 'swap-horizontal', iconColor: colors.accent, description: `Substitution - ${home}` },
  ];
}

export function LiveMatchScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    getEventById(eventId).then((result) => setEvent(result ?? null));
    getMarketsByEventId(eventId).then(setMarkets);
  }, [eventId]);

  if (!event) {
    return (
      <Screen>
        <Header title="Live Match" onBack={navigation.goBack} />
      </Screen>
    );
  }

  const timeline = event.category === 'FOOTBALL' ? getDemoTimelineForEvent(event, colors) : [];

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection) return;
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
      <Header title={event.competition} onBack={navigation.goBack} right={<Badge label="LIVE" status="LIVE" />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <AppText variant="h2" style={styles.teamName} numberOfLines={1}>
              {event.homeTeam?.name}
            </AppText>
            <AppText variant="display" color={colors.accent}>
              {event.homeTeam?.score} - {event.awayTeam?.score}
            </AppText>
            <AppText variant="h2" style={styles.teamName} numberOfLines={1} align="right">
              {event.awayTeam?.name}
            </AppText>
          </View>
          {event.minuteLabel && (
            <AppText variant="captionMedium" color={colors.live} align="center" style={styles.minute}>
              {event.minuteLabel}
            </AppText>
          )}
        </Card>

        <AppText variant="h3" style={styles.sectionTitle}>
          Match Timeline
        </AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.demoLabel}>
          Demo timeline — not live data
        </AppText>
        <Card style={styles.timelineCard}>
          {timeline.length === 0 ? (
            <AppText variant="body" color={colors.textSecondary}>
              No timeline available for this match.
            </AppText>
          ) : (
            timeline.map((entry, index) => (
              <View
                key={`${entry.minute}-${entry.description}`}
                style={[styles.timelineRow, index === timeline.length - 1 && styles.timelineRowLast]}
              >
                <AppText variant="captionMedium" color={colors.textMuted} style={styles.timelineMinute}>
                  {entry.minute}
                </AppText>
                <Ionicons name={entry.icon} size={layout.iconSizeSmall} color={entry.iconColor} />
                <AppText variant="bodyMedium" style={styles.timelineText}>
                  {entry.description}
                </AppText>
              </View>
            ))
          )}
        </Card>

        <AppText variant="h3" style={styles.sectionTitle}>
          Markets
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

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    scoreCard: {
      marginBottom: spacing.xl,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    teamName: {
      flex: 1,
    },
    minute: {
      marginTop: spacing.sm,
    },
    sectionTitle: {
      marginBottom: spacing.xs,
    },
    demoLabel: {
      marginBottom: spacing.md,
    },
    timelineCard: {
      marginBottom: spacing.xl,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    timelineRowLast: {
      paddingBottom: 0,
      marginBottom: 0,
      borderBottomWidth: 0,
    },
    timelineMinute: {
      width: 32,
    },
    timelineText: {
      flex: 1,
    },
  });
