import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';

export type BadgeStatus =
  | 'LIVE'
  | 'OPEN'
  | 'WON'
  | 'LOST'
  | 'VOID'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'NEUTRAL';

interface BadgeProps {
  label: string;
  status?: BadgeStatus;
}

export function Badge({ label, status = 'NEUTRAL' }: BadgeProps) {
  const { colors } = useTheme();

  const statusColors: Record<BadgeStatus, { text: string; background: string }> = {
    LIVE: { text: colors.live, background: colors.negativeMuted },
    OPEN: { text: colors.positive, background: colors.positiveMuted },
    WON: { text: colors.positive, background: colors.positiveMuted },
    LOST: { text: colors.negative, background: colors.negativeMuted },
    VOID: { text: colors.textSecondary, background: colors.surfaceElevated },
    PENDING: { text: colors.warning, background: colors.warningMuted },
    APPROVED: { text: colors.positive, background: colors.positiveMuted },
    REJECTED: { text: colors.negative, background: colors.negativeMuted },
    SUSPENDED: { text: colors.warning, background: colors.warningMuted },
    NEUTRAL: { text: colors.textSecondary, background: colors.surfaceElevated },
  };

  const palette = statusColors[status];
  return (
    <View style={[styles.base, { backgroundColor: palette.background }]}>
      <AppText variant="label" color={palette.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});
