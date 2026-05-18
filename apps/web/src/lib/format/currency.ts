/**
 * Display + parsing helpers for BRL prices. All monetary values are
 * stored in **integer cents** in Firestore so we never need to do
 * floating-point math on a total — see `OrderItem.priceCents`, etc.
 *
 * `formatCents` renders user-facing strings ("R$ 12,50").
 * `parseBrlInput` accepts whatever the user types ("12,50", "12.50",
 * "R$ 12", "1.234,56") and returns the cent value, or `null` if the
 * input can't be interpreted as a non-negative amount.
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return BRL_FORMATTER.format(0);
  }
  return BRL_FORMATTER.format(cents / 100);
}

export function parseBrlInput(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[Rr]\$\s?/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
