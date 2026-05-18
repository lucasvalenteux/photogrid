'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { DashboardHeader } from './dashboard-header';
import { Sidebar } from './sidebar';

/**
 * Client-side shell that wraps the entire dashboard layout. Owns the
 * mobile-drawer state for the sidebar so the Sidebar and DashboardHeader
 * (separate sibling components) can coordinate open/close without
 * lifting state into the route-segment layout, which would have to be
 * marked `use client` and lose static rendering benefits.
 *
 * Auto-closes the drawer on every pathname change so navigating from
 * the drawer feels natural — the user doesn't have to tap the backdrop
 * after picking an item.
 */
export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
