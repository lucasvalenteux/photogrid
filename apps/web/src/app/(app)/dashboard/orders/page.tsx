'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Badge, Button, cn } from '@photogrid/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { formatCents } from '@/lib/format/currency';
import { displayBrPhone, whatsappLink } from '@/lib/format/phone';
import {
  generateAccessToken,
  markOrderAsPaid,
  subscribeToStudioOrders,
} from '@/lib/services/order-service';
import { useAuth } from '@/lib/hooks/use-auth';
import type { OrderDoc } from '@/types';

function partition(orders: OrderDoc[]): {
  pending: OrderDoc[];
  paid: OrderDoc[];
  abandoned: OrderDoc[];
} {
  const pending: OrderDoc[] = [];
  const paid: OrderDoc[] = [];
  const abandoned: OrderDoc[] = [];
  for (const order of orders) {
    if (order.status === 'pending') pending.push(order);
    else if (order.status === 'paid') paid.push(order);
    else if (order.status === 'cart') abandoned.push(order);
  }
  return { pending, paid, abandoned };
}

export default function OrdersPage() {
  const { studio } = useAuth();
  const [orders, setOrders] = React.useState<OrderDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingId, setMarkingId] = React.useState<string | null>(null);

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
        console.error('[orders] subscription error', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [studio]);

  const { pending, paid, abandoned } = React.useMemo(
    () => partition(orders),
    [orders],
  );

  const onMarkPaid = async (order: OrderDoc) => {
    if (markingId) return;
    setMarkingId(order.id);
    try {
      const token = generateAccessToken();
      await markOrderAsPaid(order.id, token);
      toast.success('Pedido marcado como pago. Link de acesso gerado.');
    } catch (error) {
      console.error('[orders] mark paid failed', error);
      toast.error('Falha ao marcar como pago.');
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pedidos
        </h1>
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pedidos
        </h1>
        <EmptyState
          icon={ShoppingBag}
          title="Você ainda não recebeu pedidos."
          description="Quando alguém comprar suas fotos, o pedido aparecerá aqui."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirme pagamentos via Pix manualmente — ao marcar como pago,
          o cliente recebe um link único para baixar os arquivos.
        </p>
      </header>

      <OrdersTable
        title="Aguardando confirmação"
        description="O cliente clicou em &ldquo;pagamento realizado&rdquo;. Verifique o recebimento no seu banco e marque como pago para liberar os arquivos."
        emptyLabel="Nenhum pedido aguardando confirmação."
        orders={pending}
        renderActions={(order) => (
          <Button
            type="button"
            size="sm"
            onClick={() => onMarkPaid(order)}
            loading={markingId === order.id}
            disabled={Boolean(markingId)}
          >
            {markingId === order.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Marcar como pago
          </Button>
        )}
      />

      <OrdersTable
        title="Pagos"
        description="Pedidos confirmados. O cliente pode acessar os arquivos pelo link único."
        emptyLabel="Nenhum pedido pago ainda."
        orders={paid}
        renderActions={(order) =>
          order.accessToken ? (
            <Link
              href={ROUTES.myPurchasesToken(order.accessToken)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Ver link de acesso
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Sem link</span>
          )
        }
      />

      <OrdersTable
        title="Carrinhos não finalizados"
        description="Leads com interesse — clientes que adicionaram itens mas não chegaram a clicar em pagamento."
        emptyLabel="Nenhum carrinho em aberto."
        orders={abandoned}
        renderActions={(order) => (
          <WhatsappCta phone={order.customerPhone} order={order} />
        )}
      />
    </div>
  );
}

interface OrdersTableProps {
  title: string;
  description: string;
  emptyLabel: string;
  orders: OrderDoc[];
  renderActions: (order: OrderDoc) => React.ReactNode;
}

function OrdersTable({
  title,
  description,
  emptyLabel,
  orders,
  renderActions,
}: OrdersTableProps) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}{' '}
          {orders.length > 0 ? (
            <span className="ml-1 text-foreground">{orders.length}</span>
          ) : null}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              renderActions={renderActions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderRow({
  order,
  renderActions,
}: {
  order: OrderDoc;
  renderActions: (order: OrderDoc) => React.ReactNode;
}) {
  const date = new Date(order.createdAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const customerLabel = order.customerName || 'Sem nome';

  return (
    <li className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {order.items[0]?.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={order.items[0].thumbnailUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {customerLabel}
            </p>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {displayBrPhone(order.customerPhone)} · {order.galleryTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {order.items.length}{' '}
            {order.items.length === 1 ? 'item' : 'itens'} · {dateLabel}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">
          {formatCents(order.totalCents)}
        </span>
        {renderActions(order)}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: OrderDoc['status'] }) {
  if (status === 'paid') return <Badge variant="success">Pago</Badge>;
  if (status === 'pending') {
    return (
      <Badge variant="brand" className="inline-flex items-center gap-1">
        <Clock className="size-3" />
        Aguardando
      </Badge>
    );
  }
  if (status === 'cancelled') {
    return <Badge variant="outline">Cancelado</Badge>;
  }
  return <Badge variant="outline">Carrinho</Badge>;
}

function WhatsappCta({
  phone,
  order,
}: {
  phone: string;
  order: OrderDoc;
}) {
  const link = whatsappLink(phone);
  if (!link) {
    return (
      <span className={cn('text-xs text-muted-foreground')}>Sem telefone</span>
    );
  }
  const items = order.items
    .map((item) => `• ${item.title}`)
    .slice(0, 4)
    .join('%0A');
  const message = encodeURIComponent(
    `Oi! Vi que você começou um carrinho com a gente. Posso te ajudar a finalizar?`,
  );
  const _itemsHint = items;
  return (
    <a
      href={`${link}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <MessageCircle className="size-3.5" />
      WhatsApp
    </a>
  );
}
