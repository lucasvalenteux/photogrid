'use client';

import Link from 'next/link';

import { ROUTES } from '@photogrid/config';
import { Button, Logo } from '@photogrid/ui';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between">
        <Link href={ROUTES.home} className="flex items-center" aria-label="Photogrid">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={ROUTES.login}>Começar agora</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
