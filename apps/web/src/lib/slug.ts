import { RESERVED_SLUGS, SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from '@photogrid/config';

/**
 * Convert any human input into a deterministic URL-safe slug.
 * Rules:
 *  - lowercase
 *  - strip diacritics
 *  - collapse non-alphanumerics to a single dash
 *  - trim leading/trailing dashes
 *  - clamp to SLUG_MAX_LENGTH
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}

export type SlugValidationError =
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'reserved';

export function validateSlug(slug: string): SlugValidationError | null {
  if (slug.length < SLUG_MIN_LENGTH) return 'too_short';
  if (slug.length > SLUG_MAX_LENGTH) return 'too_long';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return 'invalid_chars';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

export const SLUG_ERROR_MESSAGES: Record<SlugValidationError, string> = {
  too_short: `Use pelo menos ${SLUG_MIN_LENGTH} caracteres.`,
  too_long: `Use no máximo ${SLUG_MAX_LENGTH} caracteres.`,
  invalid_chars: 'Use apenas letras minúsculas, números e hífens.',
  reserved: 'Este endereço é reservado, escolha outro.',
};
