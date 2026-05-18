const ADMIN_EMAILS = new Set(['luckvalente@gmail.com']);

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isSystemAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has(normalizeAdminEmail(email));
}

