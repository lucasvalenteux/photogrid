'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@photogrid/config';
import { cn, Logo } from '@photogrid/ui';

import { SIDEBAR_NAV } from './sidebar-nav';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegação principal"
      className="hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex"
    >
      <div className="flex h-16 items-center px-6">
        <Link href={ROUTES.dashboard} aria-label="Photogrid">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {SIDEBAR_NAV.map((item) => {
          const isActive =
            item.href === ROUTES.dashboard
              ? pathname === ROUTES.dashboard
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-muted text-ink'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-ink',
              )}
            >
              <Icon
                className={cn(
                  'size-4 transition-colors',
                  isActive ? 'text-brand-500' : 'text-muted-foreground group-hover:text-ink',
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-foreground">Plano gratuito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualize para liberar galerias ilimitadas.
          </p>
        </div>
      </div>
    </aside>
  );
}
