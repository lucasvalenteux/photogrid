import Link from 'next/link';
import { Camera, ShoppingBag } from 'lucide-react';

import { APP_NAME, ROUTES } from '@photogrid/config';
import { Logo, cn } from '@photogrid/ui';

import { CartProvider } from '@/lib/cart/cart-context';
import { getStorefrontThemePreset } from '@/lib/storefront-themes';
import type { StudioDoc } from '@/types';

import { CartButton } from './cart-button';
import { FloatingCartBar } from './floating-cart-bar';

interface StorefrontShellProps {
  studio: StudioDoc;
  children: React.ReactNode;
}

export function StorefrontShell({ studio, children }: StorefrontShellProps) {
  const theme = getStorefrontThemePreset(studio.storefrontTheme);

  return (
    <CartProvider studioId={studio.id}>
      <div className={cn('flex min-h-dvh flex-col', theme.backgroundClassName)}>
        <header
          className={cn(
            'sticky top-0 z-30 border-b backdrop-blur-md',
            theme.headerClassName,
          )}
        >
          <div className="container-app flex h-16 items-center justify-between gap-3">
            <Link
              href={ROUTES.studio(studio.slug)}
              className="flex min-w-0 items-center gap-3 group"
            >
              {studio.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={studio.logoUrl}
                  alt={`Logo de ${studio.name}`}
                  className="size-9 shrink-0 rounded-lg object-cover shadow-sm transition-transform group-hover:-rotate-3"
                />
              ) : (
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-ink text-white shadow-sm transition-transform group-hover:-rotate-3">
                  <Camera className="size-4" />
                </span>
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold leading-tight text-ink">
                  {studio.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {studio.slug}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={ROUTES.myPurchases}
                className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
                aria-label="Acompanhar minhas compras"
              >
                <ShoppingBag className="size-3.5" />
                <span className="hidden sm:inline">Minhas compras</span>
              </Link>
              <CartButton slug={studio.slug} />
              <Link
                href={ROUTES.home}
                aria-label={`${APP_NAME} home`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Logo withWordmark={false} size={18} />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-20 sm:pb-24">{children}</main>
        <FloatingCartBar slug={studio.slug} />

        <footer className={cn('border-t', theme.footerClassName)}>
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
    </CartProvider>
  );
}
