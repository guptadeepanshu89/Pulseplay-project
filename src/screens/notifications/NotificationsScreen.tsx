import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Header, IconBadge, RefreshableScrollView, Screen, SkeletonList, Touchable } from '@components/common';
import { cardElevation, ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { ThemeScheme, useTheme } from '@context/ThemeContext';
import { useNotifications } from '@context/NotificationContext';
import { formatRelativeTime } from '@utils/formatDate';
import { NotificationType } from '@/types/notification';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type IoniconName = keyof typeof Ionicons.glyphMap;

const TYPE_ICON: Record<NotificationType, IoniconName> = {
  WALLET_APPROVED: 'checkmark-circle-outline',
  WALLET_REJECTED: 'close-circle-outline',
  BET_PLACED: 'ticket-outline',
  BET_SETTLED: 'trophy-outline',
  MARKET_SUSPENDED: 'pause-circle-outline',
  MARKET_RESUMED: 'play-circle-outline',
  ACCOUNT_ALERT: 'alert-circle-outline',
};

const SKELETON_ROW_HEIGHT = 84;
const SKELETON_COUNT = 4;

export function NotificationsScreen({ navigation }: Props) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { notifications, loading, refresh, markRead, markAllRead, unreadCount } = useNotifications();

  return (
    <Screen>
      <Header title="Notifications" onBack={navigation.goBack} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={SKELETON_COUNT} itemHeight={SKELETON_ROW_HEIGHT} />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="You're all caught up." />
      ) : (
        <>
          {unreadCount > 0 && (
            <Touchable onPress={markAllRead} style={styles.markAllRow}>
              <AppText variant="captionMedium" color={colors.accent}>
                Mark all as read
              </AppText>
            </Touchable>
          )}
          <RefreshableScrollView onRefresh={refresh} contentContainerStyle={styles.content}>
            {notifications.map((notification) => (
              <Touchable
                key={notification.id}
                onPress={() => markRead(notification.id)}
                style={[styles.row, !notification.read && styles.rowUnread]}
              >
                <IconBadge icon={TYPE_ICON[notification.type]} size={ICON_WRAPPER_SIZE} style={styles.iconWrapper} />
                <View style={styles.details}>
                  <AppText variant="bodySemibold">{notification.title}</AppText>
                  <AppText variant="body" color={colors.textSecondary}>
                    {notification.message}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted} style={styles.time}>
                    {formatRelativeTime(notification.createdAt)}
                  </AppText>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </Touchable>
            ))}
          </RefreshableScrollView>
        </>
      )}
    </Screen>
  );
}

const ICON_WRAPPER_SIZE = 44;
const UNREAD_DOT_SIZE = 8;

const createStyles = (colors: ColorPalette, scheme: ThemeScheme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    markAllRow: {
      alignItems: 'flex-end',
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...cardElevation(colors, scheme),
    },
    rowUnread: {
      borderColor: colors.accentMuted,
      backgroundColor: colors.surfaceElevated,
    },
    iconWrapper: {
      marginRight: spacing.md,
    },
    details: {
      flex: 1,
      gap: spacing.xxs,
    },
    time: {
      marginTop: spacing.xxs,
    },
    unreadDot: {
      width: UNREAD_DOT_SIZE,
      height: UNREAD_DOT_SIZE,
      borderRadius: radius.full,
      backgroundColor: colors.accent,
      marginTop: spacing.xs,
      marginLeft: spacing.sm,
    },
  });
