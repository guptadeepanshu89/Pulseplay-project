import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppText,
  AppTopBar,
  Avatar,
  Card,
  HorizontalCardRow,
  IconBadge,
  RefreshableScrollView,
  Screen,
  SectionHeader,
  Touchable,
} from '@components/common';
import { EventCard, EVENT_CARD_HEIGHT } from '@components/market/EventCard';
import { EventsMarketsLoadingSkeleton } from '@components/market/EventsMarketsLoadingSkeleton';
import { MarketOddsCard, MARKET_ODDS_CAROUSEL_HEIGHT } from '@components/market/MarketOddsCard';
import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { formatCurrency } from '@utils/formatCurrency';
import { useAuth } from '@context/AuthContext';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { useWallet } from '@context/WalletContext';
import { useBetSlip } from '@context/BetSlipContext';
import { useLoadOnMount } from '@hooks/useLoadOnMount';
import { getLiveEvents } from '@services/eventService';
import { getMarkets } from '@services/marketService';
import { getRecentBets } from '@services/betService';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { Bet } from '@/types/bet';
import { RootStackParamList } from '@navigation/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TOP_MARKETS_LIMIT = 3;

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface QuickAccessItem {
  label: string;
  icon: IoniconName;
  onPress: (navigation: Nav, firstCryptoEventId?: number) => void;
}

const QUICK_ACCESS: QuickAccessItem[] = [
  {
    label: 'Crypto',
    icon: 'logo-bitcoin',
    onPress: (navigation, firstCryptoEventId) =>
      firstCryptoEventId !== undefined
        ? navigation.navigate('CryptoDetail', { eventId: firstCryptoEventId })
        : navigation.navigate('MainTabs', { screen: 'Markets' }),
  },
  { label: 'Football', icon: 'football-outline', onPress: (navigation) => navigation.navigate('Football') },
  { label: 'Election', icon: 'flag-outline', onPress: (navigation) => navigation.navigate('Election') },
  {
    label: 'More',
    icon: 'grid-outline',
    onPress: (navigation) => navigation.navigate('MainTabs', { screen: 'Markets' }),
  },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { wallet } = useWallet();
  const { toggleSelection } = useBetSlip();

  const [liveEvents, setLiveEvents] = useState<MarketEvent[]>([]);
  const [topMarkets, setTopMarkets] = useState<Market[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [recentBets, setRecentBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [live, markets, bets] = await Promise.all([getLiveEvents(), getMarkets(), getRecentBets(3)]);
    setLiveEvents(live);
    setEvents(live);
    setTopMarkets(markets.slice(0, TOP_MARKETS_LIMIT));
    setRecentBets(bets);
    setLoading(false);
  }, []);

  useLoadOnMount(loadData);

  const firstCryptoEventId = events.find((event) => event.category === 'CRYPTO')?.id;

  const eventNameFor = (eventId: number) => events.find((event) => event.id === eventId)?.name;

  const handleSelectMarketOdds = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection) return;
    toggleSelection({
      eventId: market.eventId,
      eventName: eventNameFor(market.eventId) ?? market.name,
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
      <AppTopBar />
      <RefreshableScrollView onRefresh={loadData} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <AppText variant="h2">Hello, {user?.name.split(' ')[0] ?? 'there'}</AppText>
            <AppText variant="body" color={colors.textSecondary}>
              Welcome back!
            </AppText>
          </View>
          <Avatar name={user?.name ?? 'User'} />
        </View>

        <Card style={styles.balanceCard}>
          <AppText variant="captionMedium" color={colors.textSecondary}>
            Total Wallet Balance
          </AppText>
          <AppText variant="display" style={styles.balanceAmount}>
            {formatCurrency((wallet?.availableBalance ?? 0) + (wallet?.lockedBalance ?? 0))}
          </AppText>
          <AppButton label="Add Funds" onPress={() => navigation.navigate('CreateRequest')} variant="primary" fullWidth />
        </Card>

        <View style={styles.quickAccessRow}>
          {QUICK_ACCESS.map((item) => (
            <Touchable
              key={item.label}
              style={styles.quickAccessItem}
              onPress={() => item.onPress(navigation, firstCryptoEventId)}
            >
              <IconBadge
                icon={item.icon}
                size={QUICK_ACCESS_ICON_SIZE}
                iconSize={layout.iconSizeLarge}
                borderRadius={radius.lg}
                backgroundColor={scheme === 'light' ? colors.accentMuted : colors.surface}
                bordered={scheme !== 'light'}
              />
              <AppText variant="caption" color={colors.textSecondary}>
                {item.label}
              </AppText>
            </Touchable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <EventsMarketsLoadingSkeleton />
          </View>
        ) : (
          <>
            <SectionHeader title="Live Now" onSeeAll={() => navigation.navigate('MainTabs', { screen: 'Markets' })} />
            <HorizontalCardRow cardHeight={EVENT_CARD_HEIGHT}>
              {liveEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() =>
                    event.category === 'CRYPTO'
                      ? navigation.navigate('CryptoDetail', { eventId: event.id })
                      : navigation.navigate('LiveMatch', { eventId: event.id })
                  }
                />
              ))}
            </HorizontalCardRow>

            <SectionHeader title="Top Markets" onSeeAll={() => navigation.navigate('MainTabs', { screen: 'Markets' })} />
            <HorizontalCardRow cardHeight={MARKET_ODDS_CAROUSEL_HEIGHT}>
              {topMarkets.map((market) => (
                <MarketOddsCard
                  key={market.id}
                  market={market}
                  eventName={eventNameFor(market.eventId)}
                  onPressSelection={(selectionId) => handleSelectMarketOdds(market, selectionId)}
                  onPressCard={() => navigation.navigate('MarketDetail', { marketId: market.id })}
                />
              ))}
            </HorizontalCardRow>

            <SectionHeader
              title="Recent Bets"
              onSeeAll={() => navigation.navigate('MainTabs', { screen: 'MyBets' })}
            />
            <View style={styles.recentBets}>
              {recentBets.map((bet) => {
                const firstLeg = bet.selections[0];
                const legLabel =
                  bet.selections.length > 1
                    ? `${bet.selections.length}-leg Accumulator`
                    : `${firstLeg.selectionName} · ${firstLeg.marketName}`;
                return (
                  <Touchable
                    key={bet.id}
                    style={styles.recentBetRow}
                    onPress={() => navigation.navigate('BetDetail', { betId: bet.id })}
                  >
                    <View style={styles.recentBetIcon}>
                      <Ionicons
                        name={bet.status === 'WON' ? 'checkmark-circle' : 'time-outline'}
                        size={layout.iconSizeMedium}
                        color={bet.status === 'WON' ? colors.positive : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.recentBetDetails}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {firstLeg.eventName}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {legLabel}
                      </AppText>
                    </View>
                    <AppText
                      variant="bodySemibold"
                      color={bet.status === 'WON' ? colors.positive : colors.textSecondary}
                    >
                      {formatCurrency(bet.stake)}
                    </AppText>
                  </Touchable>
                );
              })}
            </View>
          </>
        )}
      </RefreshableScrollView>
    </Screen>
  );
}

const QUICK_ACCESS_ICON_SIZE = 56;

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    balanceCard: {
      marginBottom: spacing.lg,
    },
    balanceAmount: {
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    quickAccessRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    quickAccessItem: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    loadingBlock: {
      marginBottom: spacing.xl,
    },
    recentBets: {
      gap: spacing.sm,
    },
    recentBetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...cardElevation(colors, scheme),
    },
    recentBetIcon: {
      marginRight: spacing.md,
    },
    recentBetDetails: {
      flex: 1,
      gap: spacing.xxs,
    },
  });
