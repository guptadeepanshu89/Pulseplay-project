import { StyleSheet } from 'react-native';

import { Skeleton } from '@components/common';
import { spacing } from '@theme';

import { EVENT_CARD_HEIGHT } from './EventCard';
import { MARKET_ODDS_CAROUSEL_HEIGHT } from './MarketOddsCard';

const TITLE_HEIGHT = 20;
const TITLE_WIDTH = '40%';

export function EventsMarketsLoadingSkeleton() {
  return (
    <>
      <Skeleton width={TITLE_WIDTH} height={TITLE_HEIGHT} style={styles.spacing} />
      <Skeleton width="100%" height={EVENT_CARD_HEIGHT} style={styles.spacing} />
      <Skeleton width={TITLE_WIDTH} height={TITLE_HEIGHT} style={styles.spacing} />
      <Skeleton width="100%" height={MARKET_ODDS_CAROUSEL_HEIGHT} />
    </>
  );
}

const styles = StyleSheet.create({
  spacing: {
    marginBottom: spacing.md,
  },
});
