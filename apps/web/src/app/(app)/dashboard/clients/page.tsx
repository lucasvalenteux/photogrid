'use client';

import * as React from 'react';
import { MessageCircle, Users } from 'lucide-react';

import { EmptyState } from '@/components/dashboard/empty-state';
import { formatCents } from '@/lib/format/currency';
import { displayBrPhone, whatsappLink } from '@/lib/format/phone';
import { subscribeToStudioOrders } from '@/lib/services/order-service';
import { useAuth } from '@/lib/hooks/use-auth';
import type { OrderDoc } from '@/types';

/**
 * Clients are derived from completed orders rather than living in
 * their own collection. Grouping by phone gives us a stable identity
 * (we already capture the phone at checkout) without forcing the
 * customer to sign up or remember an account on the storefront.
 *
 * The aggregation runs entirely client-side off the orders
 * subscription, so we don't pay extra Firestore reads for the page.
 */
interface ClientRow {
  phone: string;
  name: string;
  totalSpentCents: number;
  ordersCount: number;
  lastPurchaseAt: string;
  galleries: Set<string>;
}

function aggregateClients(orders: OrderDoc[]): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const order of orders) {
    if (order.status !== 'paid') continue;
    const key = order.customerPhone;
    const existing = map.get(key);
    if (existing) {
      existing.totalSpentCents += order.totalCents;
      existing.ordersCount += 1;
      existing.galleries.add(order.galleryTitle);
      if (order.paidAt && order.paidAt > existing.lastPurchaseAt) {
        existing.lastPurchaseAt = order.paidAt;
      }
      // Keep the longest known name (some carts had it blank).
      if (order.customerName && order.customerName.length > existing.name.length) {
        existing.name = order.customerName;
      }
    } else {
      map.set(key, {
        phone: order.customerPhone,
        name: order.customerName ?? '',
        totalSpentCents: order.totalCents,
        ordersCount: 1,
        lastPurchaseAt: order.paidAt ?? order.createdAt,
        galleries: new Set([order.galleryTitle]),
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.lastPurchaseAt.localeCompare(a.lastPurchaseAt),
  );
}

export default function ClientsPage() {
  const { studio } = useAuth();
  const [orders, setOrders] = React.useState<OrderDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!studio) return;
    setLoading(true);
    const unsubscribe = subscribeToStudioOrders(
      studio.id,
      (next) => {
        setOrders(next);
        setLoading(false);
      },
      (error) => {
        console.error('[clients] subscription error', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [studio]);

  const clients = React.useMemo(() => aggregateClients(orders), [orders]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Clientes
        </h1>
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Clientes
        </h1>
        <EmptyState
          icon={Users}
          title="Você ainda não tem clientes cadastrados."
          description="Conforme você confirmar pedidos pagos, os clientes aparecerão aqui automaticamente."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista construída a partir dos pedidos confirmados. Toque em
          WhatsApp para retomar a conversa.
        </p>
      </header>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {clients.map((client) => (
          <ClientRow key={client.phone} client={client} />
        ))}
      </ul>
    </div>
  );
}

function ClientRow({ client }: { client: ClientRow }) {
  const wa = whatsappLink(client.phone);
  const lastDate = new Date(client.lastPurchaseAt);
  const lastLabel = Number.isFinite(lastDate.getTime())
    ? lastDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {client.name || displayBrPhone(client.phone)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {displayBrPhone(client.phone)} ·{' '}
          {client.ordersCount}{' '}
          {client.ordersCount === 1 ? 'pedido' : 'pedidos'} · última compra{' '}
          {lastLabel}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {Array.from(client.galleries).slice(0, 2).join(' · ')}
          {client.galleries.size > 2
            ? ` · +${client.galleries.size - 2} galerias`
            : ''}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">
          {formatCents(client.totalSpentCents)}
        </span>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="size-3.5" />
            WhatsApp
          </a>
        ) : null}
      </div>
    </li>
  );
}
