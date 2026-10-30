import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppNotification } from '@/types/notification';
import { NOTIFICATION_SOCKET_TYPES, useAlwaysLive } from '@/realtime/live';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notificationService';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: PropsWithChildren) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await getNotifications());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (notificationId: number) => {
    await markNotificationRead(notificationId);
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the service layer on mount
    refresh();
  }, [refresh]);
  // Socket badge updates only — full list refresh is demand-driven on Notifications screen.
  useAlwaysLive(refresh, [...NOTIFICATION_SOCKET_TYPES]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, unreadCount, loading, error, refresh, markRead, markAllRead }),
    [notifications, unreadCount, loading, error, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
