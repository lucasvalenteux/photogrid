'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Images,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  cn,
} from '@photogrid/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { formatCents } from '@/lib/format/currency';
import { displayBrPhone, whatsappLink } from '@/lib/format/phone';
import { subscribeToAlbums } from '@/lib/services/album-service';
import { subscribeToStudioClients } from '@/lib/services/client-service';
import { subscribeToGalleries } from '@/lib/services/gallery-service';
import {
  cancelOrder,
  createManualPendingOrder,
  generateAccessToken,
  markOrderAsPaid,
  subscribeToStudioOrders,
} from '@/lib/services/order-service';
import { subscribeToGalleryPhotos } from '@/lib/services/photo-service';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  resolveGalleryPrices,
  type AlbumDoc,
  type ClientDoc,
  type GalleryDoc,
  type OrderDoc,
  type PhotoDoc,
  type StudioDoc,
} from '@/types';

function partition(orders: OrderDoc[]): {
  pending: OrderDoc[];
  paid: OrderDoc[];
  cancelled: OrderDoc[];
  abandoned: OrderDoc[];
} {
  const pending: OrderDoc[] = [];
  const paid: OrderDoc[] = [];
  const cancelled: OrderDoc[] = [];
  const abandoned: OrderDoc[] = [];
  for (const order of orders) {
    if (order.status === 'pending') pending.push(order);
    else if (order.status === 'paid') paid.push(order);
    else if (order.status === 'cancelled') cancelled.push(order);
    else if (order.status === 'cart') abandoned.push(order);
  }
  return { pending, paid, cancelled, abandoned };
}

export default function OrdersPage() {
  const { studio } = useAuth();
  const [orders, setOrders] = React.useState<OrderDoc[]>([]);
  const [manualClients, setManualClients] = React.useState<ClientDoc[]>([]);
  const [galleries, setGalleries] = React.useState<GalleryDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
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
        console.error('[orders] subscription error', error);
        setLoading(false);
      },
    );
    const unsubClients = subscribeToStudioClients(
      studio.id,
      setManualClients,
      (error) => console.error('[orders] clients subscription error', error),
    );
    const unsubGalleries = subscribeToGalleries(
      studio.id,
      setGalleries,
      (error) => console.error('[orders] galleries subscription error', error),
    );
    return () => {
      unsubOrders();
      unsubClients();
      unsubGalleries();
    };
  }, [studio]);

  const { pending, paid, cancelled, abandoned } = React.useMemo(
    () => partition(orders),
    [orders],
  );
  const clients = React.useMemo(
    () => buildClientOptions(manualClients, orders),
    [manualClients, orders],
  );

  const onMarkPaid = async (order: OrderDoc) => {
    if (markingId || cancellingId) return;
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

  const onCancelOrder = async (order: OrderDoc) => {
    if (markingId || cancellingId) return;
    setCancellingId(order.id);
    try {
      await cancelOrder(order.id);
      toast.success('Pedido cancelado.');
    } catch (error) {
      console.error('[orders] cancel failed', error);
      toast.error('Falha ao cancelar pedido.');
    } finally {
      setCancellingId(null);
    }
  };

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

  if (orders.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <PageHeader onCreate={() => setCreateOpen(true)} />
        <EmptyState
          icon={ShoppingBag}
          title="Você ainda não recebeu pedidos."
          description="Quando alguém comprar suas fotos, o pedido aparecerá aqui."
          actionLabel="Criar pedido"
          onAction={() => setCreateOpen(true)}
        />
        {studio ? (
          <CreateOrderDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            studio={studio}
            clients={clients}
            galleries={galleries}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <PageHeader onCreate={() => setCreateOpen(true)} />

      <OrdersTable
        title="Aguardando confirmação"
        description="O cliente clicou em &ldquo;pagamento realizado&rdquo;. Verifique o recebimento no seu banco e marque como pago para liberar os arquivos."
        emptyLabel="Nenhum pedido aguardando confirmação."
        orders={pending}
        renderActions={(order) => (
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onMarkPaid(order)}
              loading={markingId === order.id}
              disabled={Boolean(markingId || cancellingId)}
            >
              {markingId === order.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Pago
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onCancelOrder(order)}
              loading={cancellingId === order.id}
              disabled={Boolean(markingId || cancellingId)}
            >
              {cancellingId === order.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              Cancelar
            </Button>
          </div>
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
        title="Cancelados"
        description="Pedidos que foram encerrados sem confirmação de pagamento."
        emptyLabel="Nenhum pedido cancelado."
        orders={cancelled}
        renderActions={() => (
          <span className="text-xs text-muted-foreground">Encerrado</span>
        )}
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
      {studio ? (
        <CreateOrderDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          studio={studio}
          clients={clients}
          galleries={galleries}
        />
      ) : null}
    </div>
  );
}

interface SelectableClient {
  name: string;
  phone: string;
}

function buildClientOptions(
  manualClients: ClientDoc[],
  orders: OrderDoc[],
): SelectableClient[] {
  const byPhone = new Map<string, SelectableClient>();
  for (const client of manualClients) {
    byPhone.set(client.phone, { name: client.name, phone: client.phone });
  }
  for (const order of orders) {
    if (!order.customerName) continue;
    const existing = byPhone.get(order.customerPhone);
    if (!existing || order.customerName.length > existing.name.length) {
      byPhone.set(order.customerPhone, {
        name: order.customerName,
        phone: order.customerPhone,
      });
    }
  }
  return Array.from(byPhone.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
}

function PageHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie pedidos manualmente ou confirme pagamentos via Pix para liberar
          os arquivos.
        </p>
      </div>
      <Button type="button" size="sm" onClick={onCreate}>
        <Plus className="size-4" />
        Novo pedido
      </Button>
    </header>
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
  const createdDateLabel =
    formatOrderDate(order.createdAt) ??
    formatOrderDate(order.updatedAt) ??
    'Data não registrada';
  const statusDateLabel = statusDateForOrder(order);
  const customerLabel = order.customerName || 'Sem nome';
  const itemCountLabel = `${order.items.length} ${
    order.items.length === 1 ? 'item' : 'itens'
  }`;

  return (
    <li className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {order.items[0]?.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={order.items[0].thumbnailUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Images className="size-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 max-w-full truncate text-sm font-medium text-foreground">
              {customerLabel}
            </p>
            <StatusPill status={order.status} />
            <span className="text-[11px] font-medium text-muted-foreground">
              {shortOrderId(order.id)}
            </span>
          </div>

          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            {order.galleryTitle}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <OrderMeta icon={Phone}>{displayBrPhone(order.customerPhone)}</OrderMeta>
            <OrderMeta icon={Images}>{itemCountLabel}</OrderMeta>
            <OrderMeta icon={CalendarDays}>Criado em {createdDateLabel}</OrderMeta>
            {statusDateLabel ? (
              <OrderMeta icon={Clock}>
                {statusDateLabel.label} {statusDateLabel.value}
              </OrderMeta>
            ) : null}
          </div>

          <OrderItemsSummary order={order} />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between lg:min-w-52 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
        <span className="text-sm font-semibold text-ink">
          {formatCents(order.totalCents)}
        </span>
        <div className="flex w-full justify-stretch [&>*]:w-full sm:w-auto sm:[&>*]:w-auto">
          {renderActions(order)}
        </div>
      </div>
    </li>
  );
}

function OrderMeta({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function shortOrderId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

function statusDateForOrder(
  order: OrderDoc,
): { label: string; value: string } | null {
  if (order.status === 'paid') {
    const date = formatOrderDate(order.paidAt ?? order.updatedAt);
    return date ? { label: 'Pago em', value: date } : null;
  }
  if (order.status === 'cancelled') {
    const date = formatOrderDate(order.cancelledAt ?? order.updatedAt);
    return date ? { label: 'Cancelado em', value: date } : null;
  }
  return null;
}

function formatOrderDate(value: unknown): string | null {
  const date =
    typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : isTimestampLike(value)
        ? value.toDate()
        : null;

  if (!date || !Number.isFinite(date.getTime())) return null;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function OrderItemsSummary({ order }: { order: OrderDoc }) {
  const visibleItems = order.items.slice(0, 3);
  const hiddenCount = Math.max(0, order.items.length - visibleItems.length);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visibleItems.map((item, index) => (
        <span
          key={`${item.type}:${item.itemId}:${index}`}
          className="max-w-full rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <span className="font-medium text-foreground">
            {item.type === 'album' ? 'Álbum' : 'Foto'}:
          </span>{' '}
          <span className="break-words">{item.title}</span>
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
          +{hiddenCount} {hiddenCount === 1 ? 'item' : 'itens'}
        </span>
      ) : null}
    </div>
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

function CreateOrderDialog({
  open,
  onOpenChange,
  studio,
  clients,
  galleries,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  studio: StudioDoc;
  clients: SelectableClient[];
  galleries: GalleryDoc[];
}) {
  const [clientPhone, setClientPhone] = React.useState('');
  const [galleryId, setGalleryId] = React.useState('');
  const [itemType, setItemType] = React.useState<'album' | 'photo'>('album');
  const [itemId, setItemId] = React.useState('');
  const [albums, setAlbums] = React.useState<AlbumDoc[]>([]);
  const [photos, setPhotos] = React.useState<PhotoDoc[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setClientPhone(clients[0]?.phone ?? '');
    setGalleryId(galleries[0]?.id ?? '');
    setItemType('album');
    setItemId('');
    setSaving(false);
  }, [clients, galleries, open]);

  React.useEffect(() => {
    if (!open || !galleryId) {
      setAlbums([]);
      setPhotos([]);
      return;
    }
    const unsubAlbums = subscribeToAlbums(
      galleryId,
      setAlbums,
      (error) => console.error('[orders] albums subscription error', error),
    );
    const unsubPhotos = subscribeToGalleryPhotos(
      galleryId,
      setPhotos,
      (error) => console.error('[orders] photos subscription error', error),
    );
    return () => {
      unsubAlbums();
      unsubPhotos();
    };
  }, [galleryId, open]);

  React.useEffect(() => {
    setItemId('');
  }, [galleryId, itemType]);

  const gallery = galleries.find((g) => g.id === galleryId) ?? null;
  const client = clients.find((c) => c.phone === clientPhone) ?? null;
  const prices = resolveGalleryPrices(gallery, studio);
  const itemOptions = itemType === 'album' ? albums : photos;
  const selectedAlbum =
    itemType === 'album' ? albums.find((album) => album.id === itemId) : null;
  const selectedPhoto =
    itemType === 'photo' ? photos.find((photo) => photo.id === itemId) : null;
  const currentPrice =
    itemType === 'album'
      ? prices.pricePerAlbumCents
      : prices.pricePerPhotoCents;

  const canSubmit =
    Boolean(client && gallery && itemId) && itemOptions.length > 0 && !saving;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !gallery || !canSubmit) return;

    const item =
      itemType === 'album' && selectedAlbum
        ? {
            type: 'album' as const,
            itemId: selectedAlbum.id,
            title: selectedAlbum.title,
            thumbnailUrl: selectedAlbum.coverPhotoUrl ?? null,
            photoCount: selectedAlbum.photoIds.length,
            priceCents: currentPrice,
          }
        : itemType === 'photo' && selectedPhoto
          ? {
              type: 'photo' as const,
              itemId: selectedPhoto.id,
              title: selectedPhoto.fileName || 'Foto',
              thumbnailUrl: selectedPhoto.thumbnailUrl ?? selectedPhoto.imageUrl,
              photoCount: null,
              priceCents: currentPrice,
            }
          : null;
    if (!item) return;

    setSaving(true);
    try {
      await createManualPendingOrder({
        studioId: studio.id,
        studioSlug: studio.slug,
        galleryId: gallery.id,
        galleryTitle: gallery.title,
        customerName: client.name,
        customerPhone: client.phone,
        items: [item],
      });
      toast.success('Pedido criado aguardando confirmação.');
      onOpenChange(false);
    } catch (error) {
      console.error('[orders] manual create failed', error);
      toast.error('Não foi possível criar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo pedido manual</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field>
            <Label htmlFor="manual-order-client">Cliente</Label>
            <select
              id="manual-order-client"
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
              className={selectClassName}
              disabled={saving || clients.length === 0}
              required
            >
              {clients.length === 0 ? (
                <option value="">Crie um cliente primeiro</option>
              ) : (
                clients.map((c) => (
                  <option key={c.phone} value={c.phone}>
                    {c.name} · {displayBrPhone(c.phone)}
                  </option>
                ))
              )}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="manual-order-gallery">Galeria</Label>
              <select
                id="manual-order-gallery"
                value={galleryId}
                onChange={(event) => setGalleryId(event.target.value)}
                className={selectClassName}
                disabled={saving || galleries.length === 0}
                required
              >
                {galleries.length === 0 ? (
                  <option value="">Nenhuma galeria</option>
                ) : (
                  galleries.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))
                )}
              </select>
            </Field>

            <Field>
              <Label htmlFor="manual-order-type">Tipo</Label>
              <select
                id="manual-order-type"
                value={itemType}
                onChange={(event) =>
                  setItemType(event.target.value === 'photo' ? 'photo' : 'album')
                }
                className={selectClassName}
                disabled={saving}
              >
                <option value="album">Álbum completo</option>
                <option value="photo">Foto avulsa</option>
              </select>
            </Field>
          </div>

          <Field>
            <Label htmlFor="manual-order-item">
              {itemType === 'album' ? 'Álbum comprado' : 'Foto comprada'}
            </Label>
            <select
              id="manual-order-item"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className={selectClassName}
              disabled={saving || itemOptions.length === 0}
              required
            >
              <option value="">
                {itemOptions.length === 0
                  ? itemType === 'album'
                    ? 'Nenhum álbum nesta galeria'
                    : 'Nenhuma foto nesta galeria'
                  : 'Selecione'}
              </option>
              {itemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {'title' in item ? item.title : item.fileName}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Valor aplicado: {formatCents(currentPrice)}. Para ajustar, altere
              os valores da galeria ou o padrão em configurações.
            </p>
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={saving} disabled={!canSubmit}>
              Criar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

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
