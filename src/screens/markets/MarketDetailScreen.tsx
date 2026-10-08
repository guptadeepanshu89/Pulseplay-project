import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Header, Screen, Touchable } from '@components/common';
import { OddsButton } from '@components/market/OddsButton';
import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { getMarketById } from '@services/marketService';
import { getEventById } from '@services/eventService';
import { Market } from '@/types/market';
import { MarketEvent } from '@/types/event';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MarketDetail'>;

export function MarketDetailScreen({ route, navigation }: Props) {
  const { marketId } = route.params;
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { selections, toggleSelection } = useBetSlip();
  const [market, setMarket] = useState<Market | null>(null);
  const [event, setEvent] = useState<MarketEvent | null>(null);

  useEffect(() => {
    getMarketById(marketId).then((result) => {
      setMarket(result ?? null);
      if (result) {
        getEventById(result.eventId).then((eventResult) => setEvent(eventResult ?? null));
      }
    });
  }, [marketId]);

  if (!market || !event) {
    return (
      <Screen>
        <Header title="Market" onBack={navigation.goBack} />
      </Screen>
    );
  }

  const isLive = event.status === 'LIVE';
  const isSuspended = market.status !== 'OPEN';
  const isSelected = (selectionId: number) => selections.some((item) => item.selectionId === selectionId);

  const handleToggle = (selectionId: number) => {
    if (isSuspended) return;
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection) return;
    toggleSelection({
      eventId: market.eventId,
      eventName: event.name,
      marketId: market.id,
      marketName: market.name,
      selectionId: selection.id,
      selectionName: selection.name,
      price: selection.currentPrice,
    });
  };

  return (
    <Screen>
      <Header title={event.name} onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <AppText variant="caption" color={colors.textSecondary}>
              {event.competition}
            </AppText>
            {isLive ? <Badge label="LIVE" status="LIVE" /> : <Badge label={event.status} />}
          </View>
          {event.homeTeam && event.awayTeam ? (
            <View style={styles.scoreRow}>
              <AppText variant="h2">{event.homeTeam.shortName}</AppText>
              <AppText variant="h1" color={colors.accent}>
                {event.homeTeam.score ?? '-'} : {event.awayTeam.score ?? '-'}
              </AppText>
              <AppText variant="h2">{event.awayTeam.shortName}</AppText>
            </View>
          ) : (
            <AppText variant="h2" style={styles.eventName}>
              {event.name}
            </AppText>
          )}
          {event.minuteLabel && (
            <AppText variant="captionMedium" color={colors.live} align="center">
              {event.minuteLabel}
            </AppText>
          )}
        </Card>

        <View style={styles.marketNameRow}>
          <AppText variant="h3" style={styles.marketName}>
            {market.name}
          </AppText>
          {isSuspended && <Badge label="Suspended" status="SUSPENDED" />}
        </View>
        <AppText variant="caption" color={colors.textSecondary} style={styles.marketMeta}>
          {isSuspended ? 'New bets are not accepted while this market is suspended.' : 'Last updated just now'}
        </AppText>

        <View style={styles.selections}>
          {market.selections.map((selection) => (
            <Touchable
              key={selection.id}
              style={[styles.selectionRow, isSuspended && styles.selectionRowDisabled]}
              onPress={() => handleToggle(selection.id)}
              disabled={isSuspended}
            >
              <AppText variant="bodyMedium" style={styles.selectionName}>
                {selection.name}
              </AppText>
              <OddsButton
                label="Price"
                price={selection.currentPrice}
                selected={isSelected(selection.id)}
                disabled={isSuspended}
                onPress={() => handleToggle(selection.id)}
              />
            </Touchable>
          ))}
        </View>
      </ScrollView>

      {selections.length > 0 && (
        <View style={styles.footer}>
          <AppButton label={`View Bet Slip (${selections.length})`} onPress={() => navigation.navigate('BetSlip')} fullWidth size="lg" />
        </View>
      )}
    </Screen>
  );
}

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.huge,
    },
    eventCard: {
      marginBottom: spacing.lg,
    },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eventName: {
      textAlign: 'center',
    },
    marketNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    marketName: {
      flex: 1,
    },
    marketMeta: {
      marginBottom: spacing.lg,
    },
    selections: {
      gap: spacing.sm,
    },
    selectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...cardElevation(colors, scheme),
    },
    selectionRowDisabled: {
      opacity: 0.5,
    },
    selectionName: {
      flex: 1,
    },
    footer: {
      padding: layout.screenPaddingHorizontal,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
