'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { ArrowRight, ShoppingCart } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { cn } from '@photogrid/ui';

import { useCart } from '@/lib/cart/cart-context';
import { formatCents } from '@/lib/format/currency';

interface FloatingCartBarProps {
  /** Storefront slug — used to deep-link the cart back to the right tenant. */
  slug: string;
}

/**
 * Persistent purchase nudge anchored to the bottom of the viewport.
 *
 * The pattern lifts conversion materially on mobile storefronts —
 * visitors don't have to scroll back to the header pill or hunt for
 * a checkout button. We keep the bar empty-state-safe (returns null
 * when there are no items) and hide it on the cart page itself,
 * since the page already owns the CTA.
 *
 * The bar mounts inside `StorefrontShell`, which already wraps every
 * storefront route in `<CartProvider>`. It's safe to read the cart
 * context here even before the visitor adds anything — the provider
 * starts with an empty array and the hydrate effect kicks in on
 * mount.
 */
export function FloatingCartBar({ slug }: FloatingCartBarProps) {
  const cart = useCart();
  const pathname = usePathname();

  // Avoid double-emphasising the CTA inside the cart page.
  const isCartRoute = pathname?.startsWith(ROUTES.cart);
  if (isCartRoute) return null;
  if (cart.items.length === 0) return null;

  const label =
    cart.items.length === 1
      ? '1 item no carrinho'
      : `${cart.items.length} itens no carrinho`;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40',
        'pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:pb-4',
      )}
      aria-live="polite"
    >
      <div className="container-app">
        <Link
          href={`${ROUTES.cart}?studio=${encodeURIComponent(slug)}`}
          className={cn(
            'pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3',
            'rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md',
            'transition-transform hover:-translate-y-0.5 sm:px-5',
          )}
        >
          <span className="flex items-center gap-3 text-sm">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <ShoppingCart className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">
                Total {formatCents(cart.totalCents)}
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
            Finalizar
            <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
