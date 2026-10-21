import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { useWallet } from '@context/WalletContext';
import { useNotifications } from '@context/NotificationContext';
import { formatCurrencyCompact } from '@utils/formatCurrency';
import { RootStackParamList } from '@navigation/types';
import { useConnectionState } from '@/realtime/live';

import { AppText } from './AppText';
import { IconBadge } from './IconBadge';
import { Touchable } from './Touchable';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BRAND_ICON_SIZE = 20;
const BELL_ICON_SIZE = 20;
const BRAND_MARK_SIZE = 32;
const UNREAD_DOT_SIZE = 8;

export function AppTopBar() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { wallet } = useWallet();
  const { unreadCount } = useNotifications();
  const connection = useConnectionState();
  const connectionLabel = connection === 'connected' ? 'Live' : connection === 'reconnecting' || connection === 'connecting' ? 'Reconnecting' : 'Offline';

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <IconBadge icon="pulse" size={BRAND_MARK_SIZE} iconSize={BRAND_ICON_SIZE} borderRadius={radius.md} />
        <AppText variant="bodySemibold">PulsePlay</AppText>
        <AppText variant="caption" color={connection === 'connected' ? colors.positive : colors.textMuted}>{connectionLabel}</AppText>
      </View>

      <View style={styles.actions}>
        <Touchable
          style={styles.balanceChip}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
        >
          <Ionicons name="wallet-outline" size={BELL_ICON_SIZE} color={colors.accent} />
          <AppText variant="captionMedium">{formatCurrencyCompact(wallet?.availableBalance ?? 0)}</AppText>
        </Touchable>

        <Touchable
          style={styles.bellButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={BELL_ICON_SIZE} color={colors.textPrimary} />
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </Touchable>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingHorizontal,
      height: layout.headerHeight,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    balanceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.accentMuted,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    bellButton: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: UNREAD_DOT_SIZE,
      height: UNREAD_DOT_SIZE,
      borderRadius: radius.full,
      backgroundColor: colors.negative,
    },
  });
