import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { DemoSnapshot, getDemoSnapshot, tickDemo } from '@/api/demo';
import { readableErrorMessage } from '@/api/errorMessage';
import { AppButton, AppText, Badge, Card, EmptyState, Header, Screen } from '@components/common';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { RootStackParamList } from '@navigation/types';
import { LiveEvent, useConnectionState, useLiveRefresh } from '@/realtime/live';
import { applyDemoSnapshot, connectionLabel, demoScreenView } from './demoState';

type Props = NativeStackScreenProps<RootStackParamList, 'DemoLive'>;

export function DemoLiveScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const connection = useConnectionState();
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const accept = useCallback((incoming: DemoSnapshot | null) => {
    setSnapshot((current) => applyDemoSnapshot(current, incoming));
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    if (!snapshotRef.current) setLoading(true);
    try {
      const next = await getDemoSnapshot();
      if (request.current !== id) return;
      accept(next);
      setError(null);
    } catch (err) {
      if (request.current !== id) return;
      setError(readableErrorMessage(err, 'Could not load the demo snapshot.'));
    } finally {
      if (request.current === id) setLoading(false);
    }
  }, [accept]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onLiveEvent = useCallback((event: LiveEvent) => {
    if (event.type !== 'demo.updated' || !event.data || event.data.demo !== true) return;
    const version = event.data.version;
    const price = event.data.price;
    const updatedAt = event.data.updatedAt;
    if (typeof version !== 'number' || typeof price !== 'number' || typeof updatedAt !== 'string') return;
    accept({
      demo: true,
      synthetic: true,
      settlesBets: false,
      id: 'demo-market',
      title: snapshotRef.current?.title ?? 'Demo market',
      status: snapshotRef.current?.status ?? 'OPEN',
      version,
      price,
      updatedAt,
    });
  }, [accept]);

  useLiveRefresh(load, [], undefined, onLiveEvent);

  const onTick = async () => {
    if (ticking) return;
    setTicking(true);
    setError(null);
    try {
      accept(await tickDemo());
    } catch (err) {
      setError(readableErrorMessage(err, 'Could not publish the demo update.'));
    } finally {
      setTicking(false);
    }
  };

  const view = demoScreenView({ loading, error, hasSnapshot: snapshot !== null });

  return (
    <Screen>
      <Header title="Live demo" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Badge label="DEMO — synthetic data" status="PENDING" />
        <AppText variant="body" color={colors.textSecondary}>
          This is synthetic demo data. It does not place bets, change a wallet, or settle wagers.
        </AppText>
        <AppText variant="caption" color={connection === 'connected' ? colors.positive : colors.textMuted}>
          {connectionLabel(connection)}
        </AppText>
        {view.showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <AppText variant="caption" color={colors.textMuted}>Loading demo</AppText>
          </View>
        ) : null}
        {view.showError && error ? <AppText variant="body" color={colors.negative}>{error}</AppText> : null}
        {view.showEmpty ? (
          <EmptyState icon="pulse-outline" title="No demo snapshot" message="The demo service did not return a snapshot." />
        ) : null}
        {view.showSnapshot && snapshot ? (
          <Card>
            <AppText variant="h3">{snapshot.title}</AppText>
            <AppText variant="caption" color={colors.warning}>Synthetic demo · version {snapshot.version}</AppText>
            <AppText variant="h2">{snapshot.price.toFixed(2)}</AppText>
            <AppText variant="caption" color={colors.textMuted}>Updated {snapshot.updatedAt}</AppText>
          </Card>
        ) : null}
        <View style={styles.row}>
          <AppButton label="Refresh snapshot" variant="secondary" onPress={() => void load()} disabled={loading || ticking} />
          <AppButton label="Publish demo update" onPress={() => void onTick()} loading={ticking} disabled={loading} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
