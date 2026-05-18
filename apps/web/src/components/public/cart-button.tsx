'use client';

import Link from 'next/link';
import * as React from 'react';
import { ShoppingCart } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { cn } from '@photogrid/ui';

import { useCart } from '@/lib/cart/cart-context';
import { formatCents } from '@/lib/format/currency';

interface CartButtonProps {
  /** Storefront slug for the gallery the cart belongs to — drives the deep-link back. */
  slug: string;
}

/**
 * Pill in the storefront header that shows the cart status. Stays
 * hidden until the visitor adds at least one item, then becomes a
 * subtle link to `/carrinho?studio=<slug>` with the total + badge.
 */
export function CartButton({ slug }: CartButtonProps) {
  const cart = useCart();
  if (cart.items.length === 0) return null;
  return (
    <Link
      href={`${ROUTES.cart}?studio=${encodeURIComponent(slug)}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted',
      )}
    >
      <ShoppingCart className="size-3.5" />
      <span>{cart.items.length}</span>
      <span className="hidden text-muted-foreground sm:inline">
        · {formatCents(cart.totalCents)}
      </span>
    </Link>
  );
}
