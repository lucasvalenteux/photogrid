'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { ROUTES } from '@photogrid/config';

import { getPlatformSettings } from '@/lib/services/platform-settings-service';

export function HomeRedirectGate() {
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    getPlatformSettings()
      .then((settings) => {
        if (cancelled || !settings.redirectHomeToAutoLogin) return;
        router.replace(ROUTES.autoLogin);
      })
      .catch((error) => {
        console.warn('[home] redirect setting unavailable', error);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

