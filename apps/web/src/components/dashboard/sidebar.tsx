'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { cn, Logo } from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import { subscribeToStudioOrders } from '@/lib/services/order-service';

import { SIDEBAR_NAV } from './sidebar-nav';

interface SidebarProps {
  /** Whether the mobile drawer variant is currently visible. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/**
 * Dashboard sidebar — renders two visual variants from a single
 * component:
 *
 *   - **Desktop (lg+)**: a static `<aside>` that always occupies a
 *     64-unit gutter on the left of the layout.
 *   - **Mobile (< lg)**: a slide-in drawer overlaid on top of the
 *     page, with a backdrop and a Close button. The body scroll is
 *     locked while it's open so taps on the backdrop only dismiss
 *     the drawer (not the page underneath).
 *
 * Both variants share the same nav rendering — keeping the component
 * single-source-of-truth for active state, ordering, and styles. The
 * mobile drawer is mounted unconditionally to keep CSS transitions
 * smooth; we toggle the `translate-x-*` class to slide it in and out.
 */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { studio } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = React.useState(0);

  React.useEffect(() => {
    if (!studio) {
      setPendingOrdersCount(0);
      return;
    }
    const unsubscribe = subscribeToStudioOrders(
      studio.id,
      (orders) => {
        setPendingOrdersCount(
          orders.filter((order) => order.status === 'pending').length,
        );
      },
      (error) => {
        console.error('[sidebar] orders badge subscription error', error);
        setPendingOrdersCount(0);
      },
    );
    return () => unsubscribe();
  }, [studio]);

  // Lock body scroll while the drawer is open. Without this, the page
  // behind the backdrop can be scrolled on touch devices and the
  // drawer feels broken.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Close on Escape — matches the dialog UX visitors expect from any
  // overlay menu on mobile / tablet.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [mobileOpen, onMobileClose]);

  const nav = (
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
                isActive
                  ? 'text-brand-500'
                  : 'text-muted-foreground group-hover:text-ink',
              )}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.href === ROUTES.orders && pendingOrdersCount > 0 ? (
              <span
                aria-label={`${pendingOrdersCount} pedidos aguardando confirmação`}
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
              >
                {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        aria-label="Navegação principal"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex"
      >
        <div className="flex h-16 items-center px-6">
          <Link href={ROUTES.dashboard} aria-label="Photogrid">
            <Logo />
          </Link>
        </div>
        {nav}
      </aside>

      {/* Mobile drawer + backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          role="presentation"
          onClick={onMobileClose}
          className={cn(
            'absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <aside
          aria-label="Navegação principal"
          aria-modal={mobileOpen ? 'true' : undefined}
          role="dialog"
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <Link
              href={ROUTES.dashboard}
              aria-label="Photogrid"
              onClick={onMobileClose}
            >
              <Logo />
            </Link>
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Fechar menu"
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>
          </div>
          {nav}
        </aside>
      </div>
    </>
  );
}
