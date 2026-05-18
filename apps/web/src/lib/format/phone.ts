/**
 * Brazilian phone helpers.
 *
 *   - We store phones in E.164 (`+5511999999999`) on every Firestore
 *     write so lookups (in /minhas-compras) are exact-match safe even
 *     across formatting choices.
 *   - `formatBrPhone` renders the canonical "(11) 99999-9999" form
 *     while the user is typing — it never assumes the country code.
 *   - `toE164Br` runs at the moment the value is persisted.
 *
 * Mobile (11 digits) and landline (10 digits) are both supported.
 */

/** Strip everything but digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatBrPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidBrPhone(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 10 || digits.length === 11;
}

/**
 * Convert a user-typed value to E.164 BR format, assuming the country
 * is Brazil (the storefront is BR-only for now). Returns null if the
 * input doesn't look like a valid BR phone.
 */
export function toE164Br(value: string): string | null {
  const digits = digitsOnly(value);
  if (!isValidBrPhone(digits)) return null;
  return `+55${digits}`;
}

/**
 * Render an E.164 BR phone back to the human form for display.
 * Falls back to the raw value if it doesn't match the expected
 * `+55…` prefix.
 */
export function displayBrPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const cleaned = e164.startsWith('+55') ? e164.slice(3) : digitsOnly(e164);
  return formatBrPhone(cleaned);
}

/** URL-safe WhatsApp deep link. Accepts either E.164 or formatted input. */
export function whatsappLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = digitsOnly(value);
  if (digits.length < 10) return null;
  const withCountry = digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}
