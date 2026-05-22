'use client';

import * as React from 'react';

import { useAuth } from '@/lib/hooks/use-auth';
import { recordAccountAccess } from '@/lib/services/account-access-log-service';
import type { AccountAccessEvent } from '@/types';

interface AccountAccessLoggerProps {
  event: AccountAccessEvent;
  path?: string;
}

/**
 * Fire-and-forget access telemetry for the admin accounts panel.
 * Mounted on dashboard chrome, admin, and onboarding surfaces.
 */
export function AccountAccessLogger({ event, path }: AccountAccessLoggerProps) {
  const { user, profile } = useAuth();

  React.useEffect(() => {
    if (!user?.uid || !user.email) return;
    void recordAccountAccess({
      userId: user.uid,
      email: user.email,
      event,
      path: path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      studioId: profile?.studioId ?? null,
    }).catch((error) => {
      console.warn('[account-access-log] failed to record', error);
    });
  }, [event, path, profile?.studioId, user?.email, user?.uid]);

  return null;
}
