import { Pressable, StyleSheet, View } from 'react-native';

import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { formatShortDate } from '@utils/formatDate';
import { MarketEvent } from '@/types/event';

import { AppText, Badge } from '@components/common';

interface EventCardProps {
  event: MarketEvent;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const isLive = event.status === 'LIVE';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.header}>
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={styles.competition}>
          {event.competition}
        </AppText>
        {isLive ? (
          <Badge label="LIVE" status="LIVE" />
        ) : (
          <AppText variant="caption" color={colors.textMuted}>
            {formatShortDate(event.startTime)}
          </AppText>
        )}
      </View>

      <View style={styles.matchRow}>
        <AppText variant="bodySemibold" style={styles.teamName} numberOfLines={1}>
          {event.homeTeam?.name ?? event.name}
        </AppText>
        <AppText variant="h3" color={isLive ? colors.textPrimary : colors.textMuted}>
          {event.homeTeam?.score ?? '-'}
        </AppText>
      </View>
      <View style={styles.matchRow}>
        <AppText variant="bodySemibold" style={styles.teamName} numberOfLines={1}>
          {event.awayTeam?.name ?? ''}
        </AppText>
        {event.awayTeam && (
          <AppText variant="h3" color={isLive ? colors.textPrimary : colors.textMuted}>
            {event.awayTeam.score ?? '-'}
          </AppText>
        )}
      </View>

      <AppText variant="captionMedium" color={colors.live} style={styles.minute}>
        {event.minuteLabel ?? ' '}
      </AppText>
    </Pressable>
  );
}

const CARD_WIDTH = 220;
export const EVENT_CARD_HEIGHT = 148;

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: EVENT_CARD_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...cardElevation(colors, scheme),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    competition: {
      flex: 1,
      marginRight: spacing.sm,
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xxs,
    },
    teamName: {
      flex: 1,
      marginRight: spacing.sm,
    },
    minute: {
      marginTop: spacing.xs,
    },
  });
