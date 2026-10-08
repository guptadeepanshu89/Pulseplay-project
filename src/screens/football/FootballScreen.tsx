import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Header, Screen } from '@components/common';
import { EventCard } from '@components/market/EventCard';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { getEventsByCategory } from '@services/eventService';
import { MarketEvent } from '@/types/event';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Football'>;

export function FootballScreen({ navigation }: Props) {
  const [events, setEvents] = useState<MarketEvent[]>([]);

  useEffect(() => {
    getEventsByCategory('FOOTBALL').then(setEvents);
  }, []);

  const liveEvents = events.filter((event) => event.status === 'LIVE');
  const upcomingEvents = events.filter((event) => event.status === 'SCHEDULED');

  return (
    <Screen>
      <Header title="Football" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="h3" style={styles.sectionTitle}>
          Live Matches
        </AppText>
        <View style={styles.grid}>
          {liveEvents.map((event) => (
            <View key={event.id} style={styles.gridItem}>
              <EventCard event={event} onPress={() => navigation.navigate('LiveMatch', { eventId: event.id })} />
            </View>
          ))}
        </View>

        <AppText variant="h3" style={styles.sectionTitle}>
          Upcoming Matches
        </AppText>
        <View style={styles.grid}>
          {upcomingEvents.map((event) => (
            <View key={event.id} style={styles.gridItem}>
              <EventCard event={event} onPress={() => navigation.navigate('LiveMatch', { eventId: event.id })} />
            </View>
          ))}
        </View>
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
  sectionTitle: {
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  gridItem: {
    marginBottom: spacing.sm,
  },
});
