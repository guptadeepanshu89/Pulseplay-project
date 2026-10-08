import { apiRequest } from '@/api/client';
import { AppNotification } from '@/types/notification';

export async function getNotifications(): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>('/notifications');
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiRequest<void>(`/notifications/${notificationId}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<void>('/notifications/read-all', { method: 'POST' });
}
