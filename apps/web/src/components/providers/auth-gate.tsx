'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { ROUTES } from '@photogrid/config';

import { useAuth } from '@/lib/hooks/use-auth';
import { FullscreenLoader } from '@/components/common/fullscreen-loader';

interface AuthGateProps {
  children: React.ReactNode;
  /** If true, the user must have completed onboarding (i.e. have a studio). */
  requireStudio?: boolean;
  /** If true, the user must NOT yet have a studio (onboarding screen). */
  requireNoStudio?: boolean;
}

/**
 * Client-side route gate. We deliberately do *not* implement server-side auth
 * here because Firebase Web auth is client-side; running this guard inside a
 * client component is enough to keep the UX correct.
 *
 *  - Unauthenticated  → /login
 *  - Authenticated, no studio, requireStudio        → /onboarding
 *  - Authenticated, has studio, requireNoStudio     → /dashboard
 */
export function AuthGate({ children, requireStudio = false, requireNoStudio = false }: AuthGateProps) {
  const router = useRouter();
  const { status, profile } = useAuth();

  React.useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace(ROUTES.login);
      return;
    }

    if (requireStudio && profile && !profile.studioId) {
      router.replace(ROUTES.onboarding);
      return;
    }

    if (requireNoStudio && profile?.studioId) {
      router.replace(ROUTES.dashboard);
      return;
    }
  }, [profile, requireNoStudio, requireStudio, router, status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return <FullscreenLoader />;
  }

  if (requireStudio && profile && !profile.studioId) {
    return <FullscreenLoader />;
  }

  if (requireNoStudio && profile?.studioId) {
    return <FullscreenLoader />;
  }

  return <>{children}</>;
}
