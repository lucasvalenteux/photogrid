'use client';

import { env } from '@photogrid/config';

import { auth } from '@/lib/firebase/client';

function apiUrl(path: string): string | null {
  if (!env.NEXT_PUBLIC_API_URL) return null;
  const base = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  if (!url) {
    throw new Error('API do Photogrid não configurada (NEXT_PUBLIC_API_URL).');
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login novamente para executar esta ação.');
  }

  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function deleteAccountViaApi({
  userId,
  email,
  deleteOwnedStudio,
}: {
  userId: string;
  email: string;
  deleteOwnedStudio: boolean;
}): Promise<void> {
  const params = new URLSearchParams({
    deleteStudio: deleteOwnedStudio ? 'true' : 'false',
  });
  if (email.trim()) {
    params.set('email', email.trim());
  }

  const resp = await adminFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}?${params}`, {
    method: 'DELETE',
  });

  if (resp.ok) return;

  let message = 'Não foi possível excluir a conta.';
  try {
    const body = (await resp.json()) as { detail?: string };
    if (typeof body.detail === 'string' && body.detail) {
      message = body.detail;
    }
  } catch {
    // ignore parse errors
  }
  throw new Error(message);
}

export function isAdminApiAvailable(): boolean {
  return Boolean(env.NEXT_PUBLIC_API_URL);
}
