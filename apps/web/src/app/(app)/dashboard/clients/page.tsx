'use client';

import * as React from 'react';
import { MessageCircle, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { formatCents } from '@/lib/format/currency';
import {
  displayBrPhone,
  formatBrPhone,
  isValidBrPhone,
  toE164Br,
  whatsappLink,
} from '@/lib/format/phone';
import {
  createClient,
  subscribeToStudioClients,
} from '@/lib/services/client-service';
import { subscribeToStudioOrders } from '@/lib/services/order-service';
import { useAuth } from '@/lib/hooks/use-auth';
import type { ClientDoc, OrderDoc } from '@/types';

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
  manual: boolean;
}

function aggregateClients(orders: OrderDoc[], manualClients: ClientDoc[]): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const client of manualClients) {
    map.set(client.phone, {
      phone: client.phone,
      name: client.name,
      totalSpentCents: 0,
      ordersCount: 0,
      lastPurchaseAt: client.createdAt,
      galleries: new Set(),
      manual: true,
    });
  }
  for (const order of orders) {
    if (order.status !== 'paid') continue;
    const key = order.customerPhone;
    const existing = map.get(key);
    if (existing) {
      existing.totalSpentCents += order.totalCents;
      existing.ordersCount += 1;
      existing.galleries.add(order.galleryTitle);
      existing.manual = existing.manual || false;
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
        manual: false,
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
  const [manualClients, setManualClients] = React.useState<ClientDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!studio) return;
    setLoading(true);
    const unsubOrders = subscribeToStudioOrders(
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
    const unsubClients = subscribeToStudioClients(
      studio.id,
      setManualClients,
      (error) => console.error('[clients] manual subscription error', error),
    );
    return () => {
      unsubOrders();
      unsubClients();
    };
  }, [studio]);

  const clients = React.useMemo(
    () => aggregateClients(orders, manualClients),
    [orders, manualClients],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <PageHeader onCreate={() => setCreateOpen(true)} />
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <PageHeader onCreate={() => setCreateOpen(true)} />
        <EmptyState
          icon={Users}
          title="Você ainda não tem clientes cadastrados."
          description="Cadastre um cliente manualmente ou confirme pedidos pagos para eles aparecerem aqui."
          actionLabel="Criar cliente"
          onAction={() => setCreateOpen(true)}
        />
        {studio ? (
          <CreateClientDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            studioId={studio.id}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader onCreate={() => setCreateOpen(true)} />

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {clients.map((client) => (
          <ClientRow key={client.phone} client={client} />
        ))}
      </ul>
      {studio ? (
        <CreateClientDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          studioId={studio.id}
        />
      ) : null}
    </div>
  );
}

function PageHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre clientes manualmente ou use os pedidos pagos como histórico.
        </p>
      </div>
      <Button type="button" size="sm" onClick={onCreate}>
        <Plus className="size-4" />
        Novo cliente
      </Button>
    </header>
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
          {displayBrPhone(client.phone)}
          {client.ordersCount > 0 ? (
            <>
              {' '}
              · {client.ordersCount}{' '}
              {client.ordersCount === 1 ? 'pedido' : 'pedidos'} · última compra{' '}
              {lastLabel}
            </>
          ) : (
            ' · cadastrado manualmente'
          )}
        </p>
        {client.galleries.size > 0 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {Array.from(client.galleries).slice(0, 2).join(' · ')}
            {client.galleries.size > 2
              ? ` · +${client.galleries.size - 2} galerias`
              : ''}
          </p>
        ) : null}
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

function CreateClientDialog({
  open,
  onOpenChange,
  studioId,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  studioId: string;
}) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setSaving(false);
  }, [open]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const e164 = toE164Br(phone);
    if (!e164) {
      toast.error('Digite um telefone válido com DDD.');
      return;
    }
    setSaving(true);
    try {
      await createClient({ studioId, name, phone: e164 });
      toast.success('Cliente criado.');
      onOpenChange(false);
    } catch (error) {
      console.error('[clients] create error', error);
      const message =
        error instanceof Error ? error.message : 'Não foi possível criar.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Nome</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do cliente"
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-phone">Telefone</Label>
            <Input
              id="client-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(formatBrPhone(event.target.value))}
              placeholder="(11) 99999-9999"
              disabled={saving}
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              loading={saving}
              disabled={name.trim().length < 2 || !isValidBrPhone(phone)}
            >
              Criar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
