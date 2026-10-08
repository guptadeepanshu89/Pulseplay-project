import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import { Market } from '@/types/market';

import { AppText, Badge, Card, Touchable } from '@components/common';

import { OddsButton } from './OddsButton';

interface MarketOddsCardProps {
  market: Market;
  eventName?: string;
  onPressSelection: (selectionId: number) => void;
  onPressCard?: () => void;
  selectedSelectionId?: number;
  fullWidth?: boolean;
}

export function MarketOddsCard({
  market,
  eventName,
  onPressSelection,
  onPressCard,
  selectedSelectionId,
  fullWidth = false,
}: MarketOddsCardProps) {
  const { colors } = useTheme();
  const isSuspended = market.status !== 'OPEN';

  return (
    <Touchable onPress={onPressCard} disabled={!onPressCard}>
      <Card style={fullWidth ? styles.cardFullWidth : styles.card}>
        <View style={styles.header}>
          {eventName && (
            <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={styles.eventName}>
              {eventName}
            </AppText>
          )}
          {isSuspended && <Badge label="Suspended" status="SUSPENDED" />}
        </View>
        <AppText variant="bodySemibold" style={styles.name} numberOfLines={2}>
          {market.name}
        </AppText>
        <View style={styles.selections}>
          {market.selections.map((selection) => (
            <OddsButton
              key={selection.id}
              label={selection.name}
              price={selection.currentPrice}
              selected={selectedSelectionId === selection.id}
              disabled={isSuspended}
              onPress={() => onPressSelection(selection.id)}
            />
          ))}
        </View>
      </Card>
    </Touchable>
  );
}

const CAROUSEL_CARD_WIDTH = 240;
export const MARKET_ODDS_CAROUSEL_HEIGHT = 200;

const styles = StyleSheet.create({
  card: {
    width: CAROUSEL_CARD_WIDTH,
    height: MARKET_ODDS_CAROUSEL_HEIGHT,
    borderRadius: radius.lg,
  },
  cardFullWidth: {
    width: '100%',
    marginBottom: spacing.md,
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventName: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  selections: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
