import { SYSTEM_ADMIN_EMAILS } from '@photogrid/config';

const ADMIN_EMAILS = new Set(
  SYSTEM_ADMIN_EMAILS.map((email) => email.trim().toLowerCase()),
);

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isSystemAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has(normalizeAdminEmail(email));
}

