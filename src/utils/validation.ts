const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const MIN_PASSWORD_LENGTH = 6;

function isValidEmailOrMobile(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('@')) return EMAIL_PATTERN.test(trimmed);
  return MOBILE_PATTERN.test(trimmed);
}

export function emailOrMobileError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Email or mobile number is required';
  if (!isValidEmailOrMobile(trimmed)) {
    return 'Enter a valid email address or 10-digit mobile number';
  }
  return undefined;
}

export function passwordError(value: string): string | undefined {
  if (value.length === 0) return 'Password is required';
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return undefined;
}
