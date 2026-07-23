const INDONESIA_PREFIX = '+62';
const INDONESIA_PREFIX_ALT = '62';

export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, normalized: null, reason: 'Phone number is required' };
  }

  const digits = raw.replace(/[^0-9]/g, '');

  if (!digits || digits.length < 10 || digits.length > 13) {
    return { valid: false, normalized: null, reason: 'Phone number must be 10-13 digits' };
  }

  if (digits.startsWith(INDONESIA_PREFIX_ALT)) {
    const withoutPrefix = digits.slice(2);
    if (withoutPrefix.length < 9 || withoutPrefix.length > 12) {
      return { valid: false, normalized: null, reason: 'Invalid Indonesian mobile number after 62 prefix' };
    }
    return { valid: true, normalized: `+62${withoutPrefix}`, reason: null };
  }

  if (digits.startsWith('0')) {
    const withoutZero = digits.slice(1);
    if (withoutZero.length < 9 || withoutZero.length > 12) {
      return { valid: false, normalized: null, reason: 'Invalid Indonesian mobile number after 0 prefix' };
    }
    return { valid: true, normalized: `+62${withoutZero}`, reason: null };
  }

  if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 12) {
    return { valid: true, normalized: `+62${digits}`, reason: null };
  }

  return { valid: false, normalized: null, reason: 'Unsupported phone number format. Use +62 or 62 or 0 prefix for Indonesia' };
}

export function formatPhoneDisplay(raw) {
  const result = normalizePhone(raw);
  if (!result.valid) {
    return null;
  }

  const normalized = result.normalized;
  const countryCode = normalized.slice(0, 3);
  const remaining = normalized.slice(3);

  const part2 = remaining.slice(-4);
  const part1 = remaining.slice(0, remaining.length - 4);

  if (!part1) {
    return `${countryCode} ${part2}`;
  }

  if (part1.length <= 3) {
    return `${countryCode} ${part1}-${part2}`;
  }

  const part3 = part1.slice(-3);
  const part4 = part1.slice(0, part1.length - 3);
  const formatted = part4 ? `${part4}-${part3}-${part2}` : `${part3}-${part2}`;

  return `${countryCode} ${formatted}`;
}

export function isValidPhone(raw) {
  return normalizePhone(raw).valid;
}