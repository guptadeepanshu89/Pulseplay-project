const FALLBACK = 'Something went wrong. Please try again.';

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const direct = [record.error, record.message, record.errorMessage].map(textOf).find((item) => item.length > 0) ?? '';
  const details = Array.isArray(record.details) ? record.details.map(textOf).filter((item) => item.length > 0).join(' ') : '';
  return [direct, details].filter((item) => item.length > 0).join(' ');
}

/** A message safe to render. Nested API error objects never become "[object Object]". */
export function readableErrorMessage(value: unknown, fallback = FALLBACK): string {
  const text = textOf(value);
  if (!text || text === '[object Object]') return fallback;
  return text;
}

export function readApiError(data: unknown, status: number): { message: string; code?: string } {
  const code =
    data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string'
      ? (data as { code: string }).code
      : undefined;
  const text = textOf(data);
  const genericNotFound = !text || text === 'Not Found' || /^Cannot (GET|POST|PUT|PATCH|DELETE)\b/.test(text);
  if (status === 404 && genericNotFound) {
    return { message: 'The requested service was not found. Check the API address.', code };
  }
  const fallback = status > 0 ? `Request failed (${status})` : FALLBACK;
  return { message: readableErrorMessage(data, fallback), code };
}
