import Link from 'next/link';
import { Camera } from 'lucide-react';

import { APP_NAME, ROUTES } from '@photogrid/config';
import { Logo } from '@photogrid/ui';

import type { StudioDoc } from '@/types';

interface StorefrontShellProps {
  studio: StudioDoc;
  children: React.ReactNode;
}

export function StorefrontShell({ studio, children }: StorefrontShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container-app flex h-16 items-center justify-between">
          <Link
            href={ROUTES.studio(studio.slug)}
            className="flex items-center gap-3 group"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-ink text-white shadow-sm transition-transform group-hover:-rotate-3">
              <Camera className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight text-ink">
                {studio.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {studio.slug}
              </span>
            </div>
          </Link>
          <Link
            href={ROUTES.home}
            aria-label={`${APP_NAME} home`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Logo withWordmark={false} size={18} />
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="container-app flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row">
          <span>
            © {new Date().getFullYear()} {studio.name}
          </span>
          <span className="flex items-center gap-1.5">
            Feito com
            <Link href={ROUTES.home} className="font-medium text-foreground hover:underline">
              {APP_NAME}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
