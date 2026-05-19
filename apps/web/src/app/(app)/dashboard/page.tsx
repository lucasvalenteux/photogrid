'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Flame,
  ImageIcon,
  Images,
  LayoutGrid,
  LineChart,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { Badge, Card, Skeleton, cn } from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import { formatCents } from '@/lib/format/currency';
import { displayBrPhone } from '@/lib/format/phone';
import { subscribeToGalleries } from '@/lib/services/gallery-service';
import { subscribeToStudioOrders } from '@/lib/services/order-service';
import type { GalleryDoc, OrderDoc } from '@/types';

// Pretty-print numbers in the visitor's locale (1234 → "1.234" in pt-BR).
// `undefined` locale means the browser picks based on its language, which
// matches the rest of the dashboard's date formatting.
const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const percentFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

function percent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${percentFormat.format(value)}%`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

type MoneyStat = {
  label: string;
  value: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'brand';
  loading?: boolean;
};

type ConsumptionItem = {
  label: string;
  value: number;
  icon: LucideIcon;
};

interface GalleryPerformance {
  galleryTitle: string;
  orderCount: number;
  revenueCents: number;
  pendingCents: number;
}

export default function DashboardPage() {
  const { studio } = useAuth();
  const studioId = studio?.id;

  // Single real-time subscription to galleries. We derive the album and
  // photo totals client-side from the denormalized counters on each
  // gallery doc — same data the /dashboard/galleries page uses, so the
  // numbers stay in sync without a second query.
  const [galleries, setGalleries] = React.useState<GalleryDoc[] | null>(null);
  const [orders, setOrders] = React.useState<OrderDoc[] | null>(null);

  React.useEffect(() => {
    if (!studioId) {
      setGalleries(null);
      setOrders(null);
      return;
    }
    const unsubGalleries = subscribeToGalleries(studioId, setGalleries, (err) => {
      console.error('[dashboard] gallery subscription error', err);
      setGalleries([]);
    });
    const unsubOrders = subscribeToStudioOrders(studioId, setOrders, (err) => {
      console.error('[dashboard] orders subscription error', err);
      setOrders([]);
    });
    return () => {
      unsubGalleries();
      unsubOrders();
    };
  }, [studioId]);

  const loading = galleries === null || orders === null;
  const galleryCount = galleries?.length ?? 0;
  const albumCount = (galleries ?? []).reduce(
    (sum, g) => sum + (g.albumCount ?? 0),
    0,
  );
  const photoCount = (galleries ?? []).reduce(
    (sum, g) => sum + (g.photoCount ?? 0),
    0,
  );
  const realOrders = (orders ?? []).filter((o) => o.status !== 'cart');
  const paidOrders = (orders ?? []).filter((o) => o.status === 'paid');
  const pendingOrders = (orders ?? []).filter((o) => o.status === 'pending');
  const cartOrders = (orders ?? []).filter((o) => o.status === 'cart');
  const revenueCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const pendingRevenueCents = pendingOrders.reduce(
    (sum, o) => sum + o.totalCents,
    0,
  );
  const hotLeadValueCents = cartOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const averageTicketCents =
    paidOrders.length > 0 ? Math.round(revenueCents / paidOrders.length) : 0;
  const interestedCount = paidOrders.length + pendingOrders.length + cartOrders.length;
  const conversionRate =
    interestedCount > 0 ? (paidOrders.length / interestedCount) * 100 : 0;
  const aiFaceDetectionCalls = studio?.usage?.aiFaceDetectionCalls ?? 0;
  const aiPublicFaceSearchCalls = studio?.usage?.aiPublicFaceSearchCalls ?? 0;
  const showGettingStarted = !loading && photoCount === 0;

  const moneyStats: MoneyStat[] = [
    {
      label: 'Faturamento total',
      value: formatCents(revenueCents),
      detail: `${formatCount(paidOrders.length)} pedidos pagos`,
      href: ROUTES.orders,
      icon: Wallet,
      tone: 'success',
      loading,
    },
    {
      label: 'A receber',
      value: formatCents(pendingRevenueCents),
      detail: `${formatCount(pendingOrders.length)} aguardando confirmação`,
      href: ROUTES.orders,
      icon: TrendingUp,
      tone: 'warning',
      loading,
    },
    {
      label: 'Leads quentes',
      value: formatCount(cartOrders.length),
      detail: `${formatCents(hotLeadValueCents)} em carrinhos abertos`,
      href: ROUTES.orders,
      icon: Flame,
      tone: 'brand',
      loading,
    },
  ];

  const galleryPerformance = React.useMemo(
    () => getGalleryPerformance(orders ?? []),
    [orders],
  );
  const recentOrders = React.useMemo(
    () => realOrders.slice(0, 5),
    [realOrders],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Painel do estúdio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Olá{studio?.name ? `, ${studio.name}` : ''}.
          </h1>
        </div>
        <Link
          href={ROUTES.orders}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Ver pedidos
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {showGettingStarted ? <GettingStartedCard /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {moneyStats.map((stat) => (
          <MoneyStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Radar comercial
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Conversão, ticket médio e oportunidades abertas.
              </p>
            </div>
            <LineChart className="size-5 text-muted-foreground" />
          </div>
          <div className="grid gap-0 sm:grid-cols-3">
            <RadarItem
              label="Conversão"
              value={loading ? null : percent(conversionRate)}
              detail="pagos sobre interessados"
            />
            <RadarItem
              label="Ticket médio"
              value={loading ? null : formatCents(averageTicketCents)}
              detail="por pedido pago"
            />
            <RadarItem
              label="Oportunidade aberta"
              value={
                loading
                  ? null
                  : formatCents(pendingRevenueCents + hotLeadValueCents)
              }
              detail="pendentes + carrinhos"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-base font-semibold text-ink">Próximas ações</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Onde vale atuar agora.
            </p>
          </div>
          <div className="divide-y divide-border">
            <ActionRow
              href={ROUTES.orders}
              title={`${formatCount(pendingOrders.length)} pedidos para confirmar`}
              description={formatCents(pendingRevenueCents)}
              loading={loading}
            />
            <ActionRow
              href={ROUTES.orders}
              title={`${formatCount(cartOrders.length)} leads quentes`}
              description="Carrinhos não finalizados"
              loading={loading}
            />
            <ActionRow
              href={ROUTES.galleries}
              title={`${formatCount(galleryCount)} galerias ativas`}
              description="Revise preços e publicação"
              loading={loading}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentOrdersCard loading={loading} orders={recentOrders} />
        <GalleryPerformanceCard
          loading={loading}
          galleries={galleryPerformance}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConsumptionCard
          title="Consumo geral"
          description="Uso atual da conta. Os limites entram quando os planos forem definidos."
          loading={loading}
          items={[
            { label: 'Fotos', value: photoCount, icon: ImageIcon },
            { label: 'Galerias', value: galleryCount, icon: Images },
            { label: 'Álbuns', value: albumCount, icon: LayoutGrid },
          ]}
        />
        <ConsumptionCard
          title="Chamadas de IA"
          description="Leituras de rosto na galeria e buscas públicas por face."
          loading={loading}
          items={[
            {
              label: 'Detecção em galerias',
              value: aiFaceDetectionCalls,
              icon: Sparkles,
            },
            {
              label: 'Busca pública por rosto',
              value: aiPublicFaceSearchCalls,
              icon: Sparkles,
            },
          ]}
        />
      </div>
    </div>
  );
}

function GettingStartedCard() {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Images className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">
            Comece sua loja de fotos
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Crie uma galeria, envie as primeiras fotos e publique para vender.
          </p>
        </div>
      </div>
      <Link
        href={ROUTES.galleries}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Ir para galerias
        <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}

function MoneyStatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone,
  loading,
}: MoneyStat) {
  const toneClass = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  }[tone];
  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="flex items-center justify-between text-muted-foreground">
          <span
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-full ring-1 ring-inset',
              toneClass,
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="mt-5">
          {loading ? (
            <>
              <Skeleton className="h-9 w-36" />
              <Skeleton className="mt-2 h-4 w-28" />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-ink tabular-nums">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </>
          )}
        </div>
      </Card>
    </Link>
  );
}

function RadarItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | null;
  detail: string;
}) {
  return (
    <div className="border-b border-border p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {value}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ActionRow({
  href,
  title,
  description,
  loading,
}: {
  href: string;
  title: string;
  description: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0">
        {loading ? (
          <>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-24" />
          </>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          </>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function RecentOrdersCard({
  loading,
  orders,
}: {
  loading: boolean;
  orders: OrderDoc[];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Pedidos recentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Últimas compras iniciadas ou confirmadas.
          </p>
        </div>
        <Link
          href={ROUTES.orders}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Ver todos
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyMiniState text="Nenhum pedido ainda." />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-3 p-4">
              <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                {order.items[0]?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.items[0].thumbnailUrl}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {order.customerName || displayBrPhone(order.customerPhone)}
                  </p>
                  <OrderBadge status={order.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {order.galleryTitle} · {dateLabel(order.createdAt)}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink">
                {formatCents(order.totalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GalleryPerformanceCard({
  loading,
  galleries,
}: {
  loading: boolean;
  galleries: GalleryPerformance[];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">
            Galerias com resultado
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Onde entraram pedidos e receita.
          </p>
        </div>
        <Link
          href={ROUTES.galleries}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Galerias
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : galleries.length === 0 ? (
        <EmptyMiniState text="Nenhuma galeria com pedido ainda." />
      ) : (
        <ul className="divide-y divide-border">
          {galleries.map((gallery) => (
            <li
              key={gallery.galleryTitle}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {gallery.galleryTitle}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatCount(gallery.orderCount)} pedidos ·{' '}
                  {formatCents(gallery.pendingCents)} a receber
                </p>
              </div>
              <span className="text-sm font-semibold text-ink">
                {formatCents(gallery.revenueCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConsumptionCard({
  title,
  description,
  items,
  loading,
}: {
  title: string;
  description: string;
  items: ConsumptionItem[];
  loading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4 p-5">
        {items.map((item) => (
          <ConsumptionBar
            key={item.label}
            item={item}
            loading={loading}
          />
        ))}
      </div>
    </Card>
  );
}

function ConsumptionBar({
  item,
  loading,
}: {
  item: ConsumptionItem;
  loading: boolean;
}) {
  const Icon = item.icon;
  const fillWidth = `${Math.min(100, Math.max(8, item.value * 8))}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <p className="truncate text-sm font-medium text-foreground">
            {item.label}
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
            {formatCount(item.value)}/∞
          </span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: fillWidth }}
          />
        )}
      </div>
    </div>
  );
}

function EmptyMiniState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function OrderBadge({ status }: { status: OrderDoc['status'] }) {
  if (status === 'paid') return <Badge variant="success">Pago</Badge>;
  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        Aguardando
      </Badge>
    );
  }
  return <Badge variant="outline">Cancelado</Badge>;
}

function getGalleryPerformance(orders: OrderDoc[]): GalleryPerformance[] {
  const byGallery = new Map<string, GalleryPerformance>();
  for (const order of orders) {
    if (order.status === 'cart' || order.status === 'cancelled') continue;
    const current = byGallery.get(order.galleryTitle) ?? {
      galleryTitle: order.galleryTitle,
      orderCount: 0,
      revenueCents: 0,
      pendingCents: 0,
    };
    current.orderCount += 1;
    if (order.status === 'paid') current.revenueCents += order.totalCents;
    if (order.status === 'pending') current.pendingCents += order.totalCents;
    byGallery.set(order.galleryTitle, current);
  }
  return Array.from(byGallery.values())
    .sort(
      (a, b) =>
        b.revenueCents + b.pendingCents - (a.revenueCents + a.pendingCents),
    )
    .slice(0, 5);
}
