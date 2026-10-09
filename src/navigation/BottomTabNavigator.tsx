import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { HomeScreen } from '@screens/home/HomeScreen';
import { MarketsScreen } from '@screens/markets/MarketsScreen';
import { WalletScreen } from '@screens/wallet/WalletScreen';
import { MyBetsScreen } from '@screens/bets/MyBetsScreen';
import { ProfileSecurityScreen } from '@screens/profile/ProfileSecurityScreen';

import { MainTabsParamList } from './types';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof MainTabsParamList, IoniconName> = {
  Home: 'home',
  Markets: 'stats-chart',
  Wallet: 'wallet',
  MyBets: 'ticket',
  Profile: 'person',
};

const TAB_LABELS: Record<keyof MainTabsParamList, string> = {
  Home: 'Home',
  Markets: 'Markets',
  Wallet: 'Wallet',
  MyBets: 'History',
  Profile: 'Profile',
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function BottomTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Native keeps tabs mounted when switching (instant, no data reload, scroll
        // preserved — how a real app should feel). Only the web preview unmounts on
        // blur, working around react-native-screens' web implementation leaving
        // pointer-events active on inactive stacked screens.
        unmountOnBlur: Platform.OS === 'web',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: layout.tabBarHeight,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
        tabBarLabel: TAB_LABELS[route.name],
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="MyBets" component={MyBetsScreen} />
      <Tab.Screen name="Profile" component={ProfileSecurityScreen} />
    </Tab.Navigator>
  );
}
