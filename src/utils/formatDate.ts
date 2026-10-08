const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatLongDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSeconds = Math.floor(diffMs / MS_PER_SECOND);

  if (diffSeconds < SECONDS_PER_MINUTE) {
    return 'just now';
  }
  const diffMinutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
  if (diffMinutes < MINUTES_PER_HOUR) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
  return `${diffDays}d ago`;
}
