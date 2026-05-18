import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@photogrid/config';
import { Logo } from '@photogrid/ui';

import { AuthGate } from '@/components/providers/auth-gate';
import { StudioForm } from '@/components/onboarding/studio-form';

export const metadata: Metadata = {
  title: 'Configurar estúdio',
  description: 'Crie seu estúdio Photogrid em segundos.',
};

export default function OnboardingPage() {
  return (
    <AuthGate requireNoStudio>
      <div className="relative min-h-dvh bg-background">
        <div className="absolute inset-0 -z-10 bg-radial-brand opacity-70" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-50" aria-hidden="true" />

        <header className="container-app flex h-16 items-center">
          <Link href={ROUTES.home} aria-label="Photogrid">
            <Logo />
          </Link>
        </header>

        <main className="container-app flex min-h-[calc(100dvh-4rem)] items-center justify-center pb-16">
          <div className="w-full max-w-md">
            <StudioForm />
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
