import { apiRequest, ApiError } from '@/api/client';
import { EventCategory, MarketEvent } from '@/types/event';

export async function getEvents(): Promise<MarketEvent[]> {
  return apiRequest<MarketEvent[]>('/events');
}

export async function getEventById(eventId: number): Promise<MarketEvent | undefined> {
  try {
    return await apiRequest<MarketEvent>(`/events/${eventId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function getEventsByCategory(category: EventCategory): Promise<MarketEvent[]> {
  return apiRequest<MarketEvent[]>(`/events?category=${category}`);
}

export async function getLiveEvents(): Promise<MarketEvent[]> {
  return apiRequest<MarketEvent[]>('/events?live=true');
}
