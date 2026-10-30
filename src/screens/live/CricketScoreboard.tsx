import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Card } from '@components/common';
import type { BadgeStatus } from '@components/common/Badge';
import { ColorPalette, radius, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';
import type { BallKind } from '@/api/cricketPayload';
import type { CricketMatchView, CricketTeamHeader, CricketUiStatus } from './cricketMatchView';

interface Props {
  view: CricketMatchView;
}

const STATUS_BADGE: Record<CricketUiStatus, BadgeStatus> = {
  LIVE: 'LIVE',
  UPCOMING: 'NEUTRAL',
  BREAK: 'PENDING',
  COMPLETED: 'APPROVED',
};

export function CricketScoreboard({ view }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { header } = view;

  return (
    <View style={styles.root} collapsable={false}>
      <Card style={styles.card}>
        <View style={styles.statusRow}>
          <Badge label={header.status} status={STATUS_BADGE[header.status]} />
          {header.inningsLabel ? (
            <AppText variant="captionMedium" color={colors.textMuted} style={styles.innings}>
              {header.inningsLabel}
            </AppText>
          ) : null}
        </View>

        <View style={styles.teamsRow}>
          <TeamBlock team={header.home} align="left" colors={colors} />
          <View style={styles.scoreBlock}>
            {header.scoresUnavailable || !header.battingScore ? (
              <AppText variant="bodySemibold" color={colors.textMuted} align="center">
                {header.unavailableMessage ?? 'Live score unavailable'}
              </AppText>
            ) : (
              <>
                <AppText variant="display" color={colors.accent} align="center">
                  {header.battingScore}
                </AppText>
                {header.oversLabel ? (
                  <AppText variant="captionMedium" color={colors.textSecondary} align="center">
                    {header.oversLabel}
                  </AppText>
                ) : null}
              </>
            )}
          </View>
          <TeamBlock team={header.away} align="right" colors={colors} />
        </View>

        {!header.scoresUnavailable && (header.target || header.currentRunRate || header.requiredRunRate) ? (
          <View style={styles.ratesRow}>
            {header.target ? <StatChip label="Target" value={header.target} colors={colors} /> : null}
            {header.currentRunRate ? <StatChip label="CRR" value={header.currentRunRate} colors={colors} /> : null}
            {header.requiredRunRate ? <StatChip label="RRR" value={header.requiredRunRate} colors={colors} /> : null}
          </View>
        ) : null}

        {header.providerStatus && !header.scoresUnavailable ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.providerStatus}>
            {header.providerStatus}
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3" style={styles.sectionTitle}>
          Batting
        </AppText>
        {view.loading && view.batters.length === 0 ? (
          <ActivityIndicator color={colors.accent} />
        ) : view.batters.length === 0 ? (
          <AppText variant="body" color={colors.textMuted}>
            Batting scorecard unavailable
          </AppText>
        ) : (
          <>
            <View style={styles.tableHead}>
              <AppText variant="caption" color={colors.textMuted} style={styles.playerCol}>
                Batter
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                R
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                B
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                4s
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                6s
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                SR
              </AppText>
            </View>
            {view.batters.map((batter) => (
              <View key={`${batter.role}-${batter.name}`} style={styles.tableRow}>
                <AppText variant="bodyMedium" style={styles.playerCol} numberOfLines={1}>
                  {batter.name}
                  {batter.role === 'striker' ? ' *' : ''}
                </AppText>
                <StatCell value={batter.runs} />
                <StatCell value={batter.balls} />
                <StatCell value={batter.fours} />
                <StatCell value={batter.sixes} />
                <StatCell value={batter.strikeRate} />
              </View>
            ))}
          </>
        )}

        <AppText variant="h3" style={styles.bowlerTitle}>
          Bowling
        </AppText>
        {view.loading && !view.bowler ? (
          <ActivityIndicator color={colors.accent} />
        ) : !view.bowler ? (
          <AppText variant="body" color={colors.textMuted}>
            Bowling figures unavailable
          </AppText>
        ) : (
          <>
            <View style={styles.tableHead}>
              <AppText variant="caption" color={colors.textMuted} style={styles.playerCol}>
                Bowler
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                O
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                R
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statCol} align="right">
                W
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.statColWide} align="right">
                Eco
              </AppText>
            </View>
            <View style={styles.tableRow}>
              <AppText variant="bodyMedium" style={styles.playerCol} numberOfLines={1}>
                {view.bowler.name}
              </AppText>
              <StatCell value={view.bowler.overs} />
              <StatCell value={view.bowler.runs} />
              <StatCell value={view.bowler.wickets} />
              <StatCell value={view.bowler.economy} wide />
            </View>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3" style={styles.sectionTitle}>
          This over
        </AppText>
        {view.loading && view.currentOver.length === 0 ? (
          <ActivityIndicator color={colors.accent} />
        ) : view.currentOver.length === 0 ? (
          <AppText variant="body" color={colors.textMuted}>
            {view.header.unavailableReason === 'UNMAPPED'
              ? 'Ball-by-ball unavailable until the event is mapped to CricketData'
              : 'Ball-by-ball data unavailable'}
          </AppText>
        ) : (
          <View style={styles.overStrip} pointerEvents="none">
            {view.currentOver.map((ball) => (
              <View
                key={ball.id}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[styles.ball, { backgroundColor: ballColor(ball.kind, colors).bg }]}
              >
                <AppText variant="captionMedium" color={ballColor(ball.kind, colors).fg} align="center">
                  {ball.label}
                </AppText>
              </View>
            ))}
          </View>
        )}

        <AppText variant="h3" style={styles.bowlerTitle}>
          Ball by ball
        </AppText>
        {view.loading && view.commentary.length === 0 ? (
          <ActivityIndicator color={colors.accent} />
        ) : view.commentaryUnavailable || view.commentary.length === 0 ? (
          <AppText variant="body" color={colors.textMuted}>
            Ball-by-ball commentary unavailable
          </AppText>
        ) : (
          <View style={styles.commentary} pointerEvents="none">
            {view.commentary.map((line) => (
              <View key={line.id} style={styles.commentaryRow}>
                {line.overBall ? (
                  <AppText variant="captionMedium" color={colors.accent} style={styles.overBall}>
                    {line.overBall}
                  </AppText>
                ) : null}
                <View style={styles.commentaryBody}>
                  <AppText variant="body">{line.text}</AppText>
                  {line.extras ? (
                    <AppText variant="caption" color={colors.warning}>
                      Extra: {line.extras}
                    </AppText>
                  ) : null}
                  {line.wicket ? (
                    <AppText variant="caption" color={colors.negative}>
                      Wicket: {line.wicket}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function TeamBlock({
  team,
  align,
  colors,
}: {
  team: CricketTeamHeader;
  align: 'left' | 'right';
  colors: ColorPalette;
}) {
  return (
    <View style={[stylesShared.team, align === 'right' && stylesShared.teamRight]}>
      {team.imageUrl ? (
        <Image source={{ uri: team.imageUrl }} style={stylesShared.flag} />
      ) : (
        <Avatar name={team.name} size={36} />
      )}
      <AppText variant="captionMedium" color={colors.textMuted} numberOfLines={1}>
        {team.shortName}
      </AppText>
      <AppText variant="bodySemibold" numberOfLines={2} align={align === 'right' ? 'right' : 'left'}>
        {team.name}
      </AppText>
      {team.score ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {team.score}
          {team.overs ? ` (${team.overs})` : ''}
        </AppText>
      ) : null}
    </View>
  );
}

function StatChip({ label, value, colors }: { label: string; value: string; colors: ColorPalette }) {
  return (
    <View style={[stylesShared.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="bodySemibold">{value}</AppText>
    </View>
  );
}

function StatCell({ value, wide }: { value?: number | string; wide?: boolean }) {
  const { colors } = useTheme();
  return (
    <AppText variant="body" color={colors.textSecondary} align="right" style={wide ? stylesShared.statColWide : stylesShared.statCol}>
      {value == null ? '—' : String(value)}
    </AppText>
  );
}

function ballColor(kind: BallKind, colors: ColorPalette): { bg: string; fg: string } {
  switch (kind) {
    case 'wicket':
      return { bg: colors.negative, fg: colors.white };
    case 'boundary':
      return { bg: colors.positive, fg: colors.white };
    case 'wide':
    case 'noball':
      return { bg: colors.warning, fg: colors.black };
    case 'dot':
      return { bg: colors.surfaceElevated, fg: colors.textSecondary };
    case 'run':
      return { bg: colors.info, fg: colors.white };
    default:
      return { bg: colors.border, fg: colors.textPrimary };
  }
}

const stylesShared = StyleSheet.create({
  team: {
    width: 96,
    gap: spacing.xs,
  },
  teamRight: {
    alignItems: 'flex-end',
  },
  flag: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 72,
  },
  statCol: {
    width: 32,
  },
  statColWide: {
    width: 44,
  },
});

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: {
      overflow: 'hidden',
      maxWidth: '100%',
    },
    card: {
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    innings: {
      flex: 1,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    scoreBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    ratesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    providerStatus: {
      marginTop: spacing.sm,
    },
    sectionTitle: {
      marginBottom: spacing.sm,
    },
    bowlerTitle: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    playerCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: spacing.xs,
    },
    statCol: {
      width: 32,
    },
    statColWide: {
      width: 44,
    },
    overStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      overflow: 'hidden',
    },
    ball: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentary: {
      overflow: 'hidden',
    },
    commentaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    overBall: {
      width: 40,
    },
    commentaryBody: {
      flex: 1,
      minWidth: 0,
    },
  });
