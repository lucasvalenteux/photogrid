'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ImageIcon,
  Images,
  LayoutGrid,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { Card, Skeleton, cn } from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import { subscribeToGalleries } from '@/lib/services/gallery-service';
import type { GalleryDoc } from '@/types';

// Pretty-print numbers in the visitor's locale (1234 → "1.234" in pt-BR).
// `undefined` locale means the browser picks based on its language, which
// matches the rest of the dashboard's date formatting.
const formatCount = (value: number) => new Intl.NumberFormat().format(value);

export default function DashboardPage() {
  const { studio } = useAuth();
  const studioId = studio?.id;

  // Single real-time subscription to galleries. We derive the album and
  // photo totals client-side from the denormalized counters on each
  // gallery doc — same data the /dashboard/galleries page uses, so the
  // numbers stay in sync without a second query.
  const [galleries, setGalleries] = React.useState<GalleryDoc[] | null>(null);

  React.useEffect(() => {
    if (!studioId) {
      setGalleries(null);
      return;
    }
    const unsubscribe = subscribeToGalleries(studioId, setGalleries, (err) => {
      console.error('[dashboard] gallery subscription error', err);
      setGalleries([]);
    });
    return unsubscribe;
  }, [studioId]);

  const loading = galleries === null;
  const galleryCount = galleries?.length ?? 0;
  const albumCount = (galleries ?? []).reduce(
    (sum, g) => sum + (g.albumCount ?? 0),
    0,
  );
  const photoCount = (galleries ?? []).reduce(
    (sum, g) => sum + (g.photoCount ?? 0),
    0,
  );
  // Clientes and Pedidos are placeholders until those features ship —
  // showing them here gives the studio a sense of where the dashboard
  // is heading and keeps the layout balanced.
  const clientCount = 0;
  const orderCount = 0;

  const stats: StatCardProps[] = [
    {
      label: 'Galerias',
      value: galleryCount,
      icon: Images,
      href: ROUTES.galleries,
      loading,
    },
    {
      label: 'Álbuns',
      value: albumCount,
      icon: LayoutGrid,
      href: ROUTES.galleries,
      loading,
    },
    {
      label: 'Fotos',
      value: photoCount,
      icon: ImageIcon,
      href: ROUTES.galleries,
      loading,
    },
    {
      label: 'Clientes',
      value: clientCount,
      icon: Users,
      href: ROUTES.clients,
      loading,
    },
    {
      label: 'Pedidos',
      value: orderCount,
      icon: ShoppingBag,
      href: ROUTES.orders,
      loading,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Olá{studio?.name ? `, ${studio.name}` : ''}.
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, href, loading }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl',
      )}
    >
      <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium text-ink">{label}</span>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
              {formatCount(value)}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
