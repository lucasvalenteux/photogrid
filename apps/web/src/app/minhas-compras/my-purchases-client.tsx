'use client';

import Link from 'next/link';
import * as React from 'react';
import { ArrowLeft, Clock, Download, Lock, Phone, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { APP_NAME, ROUTES } from '@photogrid/config';
import {
  Badge,
  Button,
  Input,
  Label,
  Logo,
} from '@photogrid/ui';

import { formatCents } from '@/lib/format/currency';
import {
  displayBrPhone,
  formatBrPhone,
  isValidBrPhone,
  toE164Br,
} from '@/lib/format/phone';
import { fetchOrdersByPhone } from '@/lib/services/order-service';
import type { OrderDoc } from '@/types';

interface MyPurchasesClientProps {
  initialPhone: string | null;
}

/**
 * `/minhas-compras` — customer self-service page. Two modes:
 *
 *   - Idle: phone-only form. We accept user-typed or E.164 numbers
 *     and normalise before querying Firestore.
 *   - Listing: pending + paid orders for the phone, with the
 *     unique access link surfaced inline when the studio has marked
 *     the order as paid (downloads handled on the
 *     `/minhas-compras/[token]` detail page).
 */
export function MyPurchasesClient({ initialPhone }: MyPurchasesClientProps) {
  const [phoneInput, setPhoneInput] = React.useState(() =>
    displayBrPhone(initialPhone),
  );
  const [orders, setOrders] = React.useState<OrderDoc[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [resolvedPhone, setResolvedPhone] = React.useState<string | null>(null);

  const doLookup = React.useCallback(async (e164: string) => {
    setLoading(true);
    try {
      const list = await fetchOrdersByPhone(e164);
      setOrders(list);
      setResolvedPhone(e164);
    } catch (error) {
      console.error('[my-purchases] lookup error', error);
      toast.error('Não conseguimos buscar agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-lookup when the URL already carries a phone (post-checkout).
  React.useEffect(() => {
    if (!initialPhone) return;
    const e164 = toE164Br(initialPhone) ?? initialPhone;
    if (e164.startsWith('+55')) {
      void doLookup(e164);
    }
  }, [initialPhone, doLookup]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e164 = toE164Br(phoneInput);
    if (!e164) {
      toast.error('Digite um celular válido com DDD.');
      return;
    }
    await doLookup(e164);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container-app flex h-16 items-center justify-between">
          <Link href={ROUTES.home} className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            href={ROUTES.home}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {APP_NAME}
          </Link>
        </div>
      </header>

      <main className="container-app flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <header className="mb-8">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Minhas compras
            </h1>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              Digite o celular usado na compra para ver o status dos
              pedidos e baixar os arquivos quando estiverem liberados.
            </p>
          </header>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end sm:p-6"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="phone-lookup">Celular</Label>
              <Input
                id="phone-lookup"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={phoneInput}
                onChange={(event) => setPhoneInput(formatBrPhone(event.target.value))}
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              loading={loading}
              disabled={!isValidBrPhone(phoneInput)}
            >
              <Phone className="size-4" />
              Ver pedidos
            </Button>
          </form>

          {orders !== null ? (
            <OrdersList
              orders={orders}
              loading={loading}
              phone={resolvedPhone}
            />
          ) : null}
        </div>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="container-app py-6 text-center text-xs text-muted-foreground">
          Feito com{' '}
          <Link href={ROUTES.home} className="font-medium hover:underline">
            {APP_NAME}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function OrdersList({
  orders,
  loading,
  phone,
}: {
  orders: OrderDoc[];
  loading: boolean;
  phone: string | null;
}) {
  if (loading && orders.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Buscando seus pedidos…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <ShoppingBag className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold text-ink">
          Nenhum pedido encontrado
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {phone
            ? `Não achamos compras associadas a ${displayBrPhone(phone)}.`
            : 'Confira o número digitado e tente novamente.'}
        </p>
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </section>
  );
}

function OrderCard({ order }: { order: OrderDoc }) {
  const isPaid = order.status === 'paid';
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {order.galleryTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.items.length}{' '}
            {order.items.length === 1 ? 'item' : 'itens'} ·{' '}
            {formatCents(order.totalCents)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <ul className="mt-4 space-y-2">
        {order.items.slice(0, 4).map((item) => (
          <li
            key={`${item.type}:${item.itemId}`}
            className="flex items-center gap-3 text-xs text-muted-foreground"
          >
            <div className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <span className="flex-1 truncate text-foreground">{item.title}</span>
            <span>{formatCents(item.priceCents)}</span>
          </li>
        ))}
        {order.items.length > 4 ? (
          <li className="text-xs text-muted-foreground">
            … e mais {order.items.length - 4} itens.
          </li>
        ) : null}
      </ul>

      {isPaid && order.accessToken ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200">
          <p className="text-xs text-emerald-800">
            Pagamento confirmado. Baixe os arquivos em alta resolução.
          </p>
          <Link
            href={ROUTES.myPurchasesToken(order.accessToken)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
          >
            <Download className="size-3.5" />
            Acessar arquivos
          </Link>
        </div>
      ) : order.status === 'pending' ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          <Clock className="size-3.5" />
          Aguardando o estúdio confirmar o pagamento.
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          {statusCopy(order.status)}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: OrderDoc['status'] }) {
  if (status === 'paid') {
    return <Badge variant="success">Pago</Badge>;
  }
  if (status === 'pending') {
    return <Badge variant="brand">Aguardando confirmação</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="outline">Cancelado</Badge>;
  }
  return (
    <Badge variant="outline" className="inline-flex items-center gap-1">
      <ArrowLeft className="size-3" />
      Em aberto
    </Badge>
  );
}

function statusCopy(status: OrderDoc['status']): string {
  switch (status) {
    case 'cancelled':
      return 'Pedido cancelado.';
    case 'cart':
      return 'Carrinho em aberto.';
    default:
      return 'Status desconhecido.';
  }
}
