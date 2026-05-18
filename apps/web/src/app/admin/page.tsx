'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Cloud,
  Database,
  Edit3,
  Gauge,
  ImageIcon,
  LineChart,
  LockKeyhole,
  LogOut,
  Server,
  ShoppingBag,
  Sparkles,
  TestTube2,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { toast } from 'sonner';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Logo,
  Skeleton,
  Switch,
  cn,
} from '@photogrid/ui';

import { FullscreenLoader } from '@/components/common/fullscreen-loader';
import { isSystemAdmin } from '@/lib/admin/access';
import {
  deleteStudioCascade,
  updateAdminStudio,
} from '@/lib/admin/studio-admin-service';
import { signOut } from '@/lib/firebase/auth';
import {
  albumsCollection,
  clientsCollection,
  galleriesCollection,
  ordersCollection,
  photosCollection,
  studiosCollection,
  usersCollection,
} from '@/lib/firebase/firestore';
import { formatCents } from '@/lib/format/currency';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  subscribeToPlatformSettings,
  updateHomeRedirectSetting,
} from '@/lib/services/platform-settings-service';
import type {
  AlbumDoc,
  ClientDoc,
  GalleryDoc,
  OrderDoc,
  PhotoDoc,
  StudioDoc,
  UserDoc,
} from '@/types';

type AdminData = {
  users: UserDoc[] | null;
  studios: StudioDoc[] | null;
  galleries: GalleryDoc[] | null;
  albums: AlbumDoc[] | null;
  photos: PhotoDoc[] | null;
  orders: OrderDoc[] | null;
  clients: ClientDoc[] | null;
};

type DataKey = keyof AdminData;

type StudioRow = {
  studio: StudioDoc;
  owner: UserDoc | null;
  galleries: number;
  albums: number;
  photos: number;
  clients: number;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  carts: number;
  revenueCents: number;
  pendingCents: number;
  storageBytes: number;
};

const INITIAL_DATA: AdminData = {
  users: null,
  studios: null,
  galleries: null,
  albums: null,
  photos: null,
  orders: null,
  clients: null,
};

const EMPTY_USERS: UserDoc[] = [];
const EMPTY_STUDIOS: StudioDoc[] = [];
const EMPTY_GALLERIES: GalleryDoc[] = [];
const EMPTY_ALBUMS: AlbumDoc[] = [];
const EMPTY_PHOTOS: PhotoDoc[] = [];
const EMPTY_ORDERS: OrderDoc[] = [];
const EMPTY_CLIENTS: ClientDoc[] = [];

const numberFormat = new Intl.NumberFormat('pt-BR');
const percentFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

function formatCount(value: number): string {
  return numberFormat.format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${percentFormat.format(value)}%`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: OrderDoc['status']): string {
  if (status === 'paid') return 'Pago';
  if (status === 'pending') return 'Aguardando';
  if (status === 'cart') return 'Carrinho';
  return 'Cancelado';
}

function isTestStudio(studio: Pick<StudioDoc, 'isTest'>): boolean {
  return studio.isTest === true;
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const isAdmin = isSystemAdmin(user?.email);

  React.useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace(ROUTES.login);
      return;
    }
    if (!isAdmin) {
      router.replace(ROUTES.dashboard);
    }
  }, [isAdmin, router, status]);

  if (status !== 'authenticated' || !isAdmin) {
    return <FullscreenLoader />;
  }

  return <>{children}</>;
}

function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, errors } = useAdminData();
  const {
    settings: platformSettings,
    loading: loadingPlatformSettings,
    error: platformSettingsError,
  } = usePlatformSettings();
  const [editingStudio, setEditingStudio] = React.useState<StudioDoc | null>(null);
  const [deletingStudio, setDeletingStudio] = React.useState<StudioRow | null>(null);

  const loading = Object.values(data).some((value) => value === null);
  const users = data.users ?? EMPTY_USERS;
  const studios = data.studios ?? EMPTY_STUDIOS;
  const galleries = data.galleries ?? EMPTY_GALLERIES;
  const albums = data.albums ?? EMPTY_ALBUMS;
  const photos = data.photos ?? EMPTY_PHOTOS;
  const orders = data.orders ?? EMPTY_ORDERS;
  const clients = data.clients ?? EMPTY_CLIENTS;
  const productionStudioIds = React.useMemo(
    () =>
      new Set(
        studios
          .filter((studio) => !isTestStudio(studio))
          .map((studio) => studio.id),
      ),
    [studios],
  );
  const productionStudios = studios.filter((studio) =>
    productionStudioIds.has(studio.id),
  );
  const productionUsers = users.filter(
    (user) => !user.studioId || productionStudioIds.has(user.studioId),
  );
  const testStudioCount = studios.length - productionStudios.length;
  const productionGalleries = galleries.filter((gallery) =>
    productionStudioIds.has(gallery.studioId),
  );
  const productionAlbums = albums.filter((album) =>
    productionStudioIds.has(album.studioId),
  );
  const productionPhotos = photos.filter((photo) =>
    productionStudioIds.has(photo.studioId),
  );
  const productionOrders = orders.filter((order) =>
    productionStudioIds.has(order.studioId),
  );
  const productionClients = clients.filter((client) =>
    productionStudioIds.has(client.studioId),
  );

  const realOrders = productionOrders.filter((order) => order.status !== 'cart');
  const paidOrders = productionOrders.filter((order) => order.status === 'paid');
  const pendingOrders = productionOrders.filter(
    (order) => order.status === 'pending',
  );
  const cartOrders = productionOrders.filter((order) => order.status === 'cart');
  const revenueCents = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const pendingCents = pendingOrders.reduce(
    (sum, order) => sum + order.totalCents,
    0,
  );
  const cartCents = cartOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const storageBytes = productionPhotos.reduce(
    (sum, photo) => sum + (photo.bytes ?? 0),
    0,
  );
  const interested = paidOrders.length + pendingOrders.length + cartOrders.length;
  const conversionRate =
    interested > 0 ? (paidOrders.length / interested) * 100 : 0;

  const studioRows = React.useMemo(
    () => buildStudioRows({ studios, users, galleries, albums, photos, orders, clients }),
    [albums, clients, galleries, orders, photos, studios, users],
  );

  const recentUsers = React.useMemo(
    () =>
      [...productionUsers]
        .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
        .slice(0, 6),
    [productionUsers],
  );

  const recentOrders = React.useMemo(
    () =>
      [...realOrders]
        .sort(
          (a, b) =>
            timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt),
        )
        .slice(0, 6),
    [realOrders],
  );

  const firestoreDocs =
    productionUsers.length +
    productionStudios.length +
    productionGalleries.length +
    productionAlbums.length +
    productionPhotos.length +
    productionOrders.length +
    productionClients.length;

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.login);
  };

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,_rgba(117,79,254,0.12),_transparent_32rem),linear-gradient(180deg,_#FAFAFA_0%,_#F5F5F4_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
          <Link href={ROUTES.admin} aria-label="Photogrid Admin">
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand" className="gap-1.5">
              <LockKeyhole className="size-3" />
              Admin
            </Badge>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              {user?.email}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-card/70">
              Photogrid OS
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Administração do sistema
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Visão central de usuários, estúdios, vendas, consumo e saúde
                operacional. Os dados do produto vêm do Firestore em tempo real;
                integrações externas ficam destacadas até conectarmos APIs de uso.
              </p>
                  {testStudioCount > 0 ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      <TestTube2 className="size-3.5" />
                      {formatCount(testStudioCount)}{' '}
                      {testStudioCount === 1 ? 'estúdio de teste fora' : 'estúdios de teste fora'}{' '}
                      das métricas
                    </p>
                  ) : null}
            </div>
          </div>
          <Card className="overflow-hidden bg-ink text-white">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">Receita geral confirmada</p>
                  {loading ? (
                    <Skeleton className="mt-3 h-10 w-40 bg-white/15" />
                  ) : (
                    <p className="mt-2 text-4xl font-semibold tracking-tight">
                      {formatCents(revenueCents)}
                    </p>
                  )}
                </div>
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/10">
                  <Wallet className="size-6" />
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <HeroMiniStat
                  label="A receber"
                  value={loading ? null : formatCents(pendingCents)}
                />
                <HeroMiniStat
                  label="Carrinhos"
                  value={loading ? null : formatCents(cartCents)}
                />
                <HeroMiniStat
                  label="Conversão"
                  value={loading ? null : formatPercent(conversionRate)}
                />
              </div>
            </div>
          </Card>
        </section>

        {errors.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Algumas leituras administrativas falharam. Confira se as regras do
            Firestore foram publicadas para o email admin. Coleções:{' '}
            {errors.join(', ')}.
          </Card>
        ) : null}

        <PlatformSettingsCard
          settings={platformSettings}
          loading={loadingPlatformSettings}
          error={platformSettingsError}
          adminEmail={user?.email ?? ''}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Usuários"
            value={loading ? null : formatCount(productionUsers.length)}
            detail={`${formatCount(productionStudios.length)} estúdios em produção`}
            icon={Users}
            tone="brand"
          />
          <MetricCard
            title="Estúdios"
            value={loading ? null : formatCount(productionStudios.length)}
            detail={`${formatCount(testStudioCount)} teste · ${formatCount(productionGalleries.length)} galerias`}
            icon={Building2}
            tone="ink"
          />
          <MetricCard
            title="Fotos hospedadas"
            value={loading ? null : formatCount(photos.length)}
            detail={`${formatBytes(storageBytes)} estimado em originais`}
            icon={ImageIcon}
            tone="success"
          />
          <MetricCard
            title="Pedidos"
            value={loading ? null : formatCount(realOrders.length)}
            detail={`${formatCount(pendingOrders.length)} aguardando confirmação`}
            icon={ShoppingBag}
            tone="warning"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
          <StudiosTable
            loading={loading}
            rows={studioRows}
            onEdit={(studio) => setEditingStudio(studio)}
            onDelete={(row) => setDeletingStudio(row)}
          />
          <OperationsCard
            loading={loading}
            docs={firestoreDocs}
            storageBytes={storageBytes}
            orders={productionOrders}
            photos={productionPhotos}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RecentUsersCard loading={loading} users={recentUsers} studios={studios} />
          <RecentOrdersCard loading={loading} orders={recentOrders} studios={studios} />
        </section>
      </div>
      <EditStudioDialog
        studio={editingStudio}
        open={Boolean(editingStudio)}
        onOpenChange={(open) => {
          if (!open) setEditingStudio(null);
        }}
      />
      <DeleteStudioDialog
        row={deletingStudio}
        open={Boolean(deletingStudio)}
        onOpenChange={(open) => {
          if (!open) setDeletingStudio(null);
        }}
      />
    </main>
  );
}

function useAdminData() {
  const { user } = useAuth();
  const [data, setData] = React.useState<AdminData>(INITIAL_DATA);
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!isSystemAdmin(user?.email)) {
      setData(INITIAL_DATA);
      setErrors([]);
      return;
    }

    const unsubscribes: Unsubscribe[] = [];
    const guarded = <K extends DataKey>(
      key: K,
      collectionSubscribe: (
        onValue: (value: NonNullable<AdminData[K]>) => void,
        onError: (error: Error) => void,
      ) => Unsubscribe,
    ) => {
      const unsubscribe = collectionSubscribe(
        (value) => {
          setData((current) => ({ ...current, [key]: value }));
          setErrors((current) => current.filter((item) => item !== key));
        },
        (error) => {
          console.error(`[admin] ${key} subscription error`, error);
          setData((current) => ({ ...current, [key]: [] }));
          setErrors((current) =>
            current.includes(key) ? current : [...current, key],
          );
        },
      );
      unsubscribes.push(unsubscribe);
    };

    setData(INITIAL_DATA);
    setErrors([]);
    guarded('users', (onValue, onError) =>
      onSnapshot(
        usersCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('studios', (onValue, onError) =>
      onSnapshot(
        studiosCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('galleries', (onValue, onError) =>
      onSnapshot(
        galleriesCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('albums', (onValue, onError) =>
      onSnapshot(
        albumsCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('photos', (onValue, onError) =>
      onSnapshot(
        photosCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('orders', (onValue, onError) =>
      onSnapshot(
        ordersCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );
    guarded('clients', (onValue, onError) =>
      onSnapshot(
        clientsCollection(),
        (snap) => onValue(snap.docs.map((doc) => doc.data())),
        onError,
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.email]);

  return { data, errors };
}

function usePlatformSettings() {
  const [settings, setSettings] = React.useState({
    redirectHomeToAutoLogin: false,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToPlatformSettings(
      (next) => {
        setSettings({
          redirectHomeToAutoLogin: next.redirectHomeToAutoLogin === true,
        });
        setError(false);
        setLoading(false);
      },
      (subscribeError) => {
        console.error('[admin] platform settings subscription error', subscribeError);
        setError(true);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { settings, loading, error };
}

function PlatformSettingsCard({
  settings,
  loading,
  error,
  adminEmail,
}: {
  settings: { redirectHomeToAutoLogin: boolean };
  loading: boolean;
  error: boolean;
  adminEmail: string;
}) {
  const [saving, setSaving] = React.useState(false);

  const onToggle = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateHomeRedirectSetting({
        enabled,
        updatedBy: adminEmail,
      });
      toast.success(
        enabled
          ? 'Home redirecionando para /loginautomatico.'
          : 'Home pública reativada.',
      );
    } catch (updateError) {
      console.error('[admin] update platform settings error', updateError);
      toast.error('Não foi possível salvar a configuração.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                  <Gauge className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    Configurações gerais da ferramenta
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Controles globais que afetam a experiência pública do Photogrid.
                  </p>
                </div>
              </div>
            </div>
            {error ? (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700"
              >
                Erro ao carregar
              </Badge>
            ) : (
              <Badge variant="success">Configuração ativa</Badge>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Redirecionar home para login automático
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Quando ativo, visitantes que acessarem{' '}
                  <span className="font-medium text-foreground">https://photogrid.store/</span>{' '}
                  serão enviados para{' '}
                  <span className="font-medium text-foreground">
                    https://photogrid.store/loginautomatico
                  </span>
                  .
                </p>
              </div>
              {loading ? (
                <Skeleton className="h-6 w-11 rounded-full" />
              ) : (
                <Switch
                  checked={settings.redirectHomeToAutoLogin}
                  onCheckedChange={onToggle}
                  disabled={saving || error}
                  label="Redirecionar home para login automático"
                />
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-ink p-5 text-white lg:border-l lg:border-t-0">
          <p className="text-sm text-white/60">Status atual</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-40 bg-white/15" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {settings.redirectHomeToAutoLogin ? 'Login direto' : 'Home pública'}
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-white/60">
            Use este controle enquanto a operação ainda é mais fechada e o foco
            está em clientes já convidados para entrar.
          </p>
        </div>
      </div>
    </Card>
  );
}

function HeroMiniStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs text-white/55">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-5 w-16 bg-white/15" />
      ) : (
        <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | null;
  detail: string;
  icon: LucideIcon;
  tone: 'brand' | 'ink' | 'success' | 'warning';
}) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    ink: 'bg-ink text-white ring-ink/15',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-full ring-1 ring-inset',
            toneClass,
          )}
        >
          <Icon className="size-5" />
        </span>
        <Badge variant="outline" className="bg-background">
          Live
        </Badge>
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {value === null ? (
          <Skeleton className="mt-2 h-9 w-28" />
        ) : (
          <p className="mt-1 text-3xl font-semibold tracking-tight text-ink tabular-nums">
            {value}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

function StudiosTable({
  loading,
  rows,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  rows: StudioRow[];
  onEdit: (studio: StudioDoc) => void;
  onDelete: (row: StudioRow) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Estúdios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consumo, vendas, plano e atividade por conta.
          </p>
        </div>
        <Badge variant="brand">{formatCount(rows.length)} contas</Badge>
      </div>
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState text="Nenhum estúdio criado ainda." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Estúdio</th>
                <th className="px-5 py-3 font-medium">Conteúdo</th>
                <th className="px-5 py-3 font-medium">Vendas</th>
                <th className="px-5 py-3 font-medium">Consumo</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Loja</th>
                <th className="px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.studio.id} className="align-top">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                        {row.studio.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.studio.logoUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Building2 className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.studio.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.owner?.email ?? 'Owner não encontrado'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Criado em {dateLabel(row.studio.createdAt)}
                        </p>
                        {isTestStudio(row.studio) ? (
                          <Badge
                            variant="outline"
                            className="mt-2 border-amber-200 bg-amber-50 text-amber-700"
                          >
                            <TestTube2 className="size-3" />
                            Teste
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    <MetricLine label="Galerias" value={row.galleries} />
                    <MetricLine label="Álbuns" value={row.albums} />
                    <MetricLine label="Fotos" value={row.photos} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">
                      {formatCents(row.revenueCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCount(row.paidOrders)} pagos ·{' '}
                      {formatCount(row.pendingOrders)} aguardando ·{' '}
                      {formatCount(row.carts)} carrinhos
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCents(row.pendingCents)} a receber
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-foreground">
                      {formatBytes(row.storageBytes)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCount(row.clients)} clientes
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className="bg-background">
                      Gratuito
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <a
                      href={`https://${APP_DOMAIN}/${row.studio.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                    >
                      /{row.studio.slug}
                      <ArrowRight className="size-3.5" />
                    </a>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(row.studio)}
                      >
                        <Edit3 className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="size-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EditStudioDialog({
  studio,
  open,
  onOpenChange,
}: {
  studio: StudioDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState('');
  const [isTest, setIsTest] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!studio) return;
    setName(studio.name);
    setIsTest(isTestStudio(studio));
  }, [studio]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studio || saving) return;

    setSaving(true);
    try {
      await updateAdminStudio({
        studioId: studio.id,
        name,
        isTest,
      });
      toast.success('Estúdio atualizado.');
      onOpenChange(false);
    } catch (error) {
      console.error('[admin] update studio error', error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível atualizar o estúdio.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar estúdio</DialogTitle>
          <DialogDescription>
            Ajuste o nome administrativo e marque contas usadas apenas para teste.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="admin-studio-name">Nome do estúdio</Label>
            <Input
              id="admin-studio-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              required
              minLength={2}
            />
            <p className="text-xs text-muted-foreground">
              O endereço público não muda automaticamente.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div>
              <Label className="text-sm">Estúdio de teste</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Remove esta conta das métricas agregadas do painel admin, mas
                mantém ela visível na tabela de estúdios.
              </p>
            </div>
            <Switch
              checked={isTest}
              onCheckedChange={setIsTest}
              disabled={saving}
              label="Marcar como estúdio de teste"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStudioDialog({
  row,
  open,
  onOpenChange,
}: {
  row: StudioRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) setConfirmation('');
  }, [open]);

  if (!row) return null;

  const expected = row.studio.slug;
  const canDelete = confirmation.trim() === expected;

  const onDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteStudioCascade({
        studioId: row.studio.id,
        slug: row.studio.slug,
        ownerId: row.studio.ownerId,
        logoStoragePath: row.studio.logoStoragePath,
      });
      toast.success('Estúdio excluído.');
      onOpenChange(false);
    } catch (error) {
      console.error('[admin] delete studio error', error);
      toast.error('Não foi possível excluir o estúdio.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir estúdio permanentemente</DialogTitle>
          <DialogDescription>
            Esta ação apaga o estúdio, galerias, álbuns, fotos, pedidos,
            clientes, sugestões de faces, reserva de slug e desvincula usuários.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{row.studio.name}</p>
          <p className="mt-1">
            {formatCount(row.galleries)} galerias · {formatCount(row.albums)} álbuns ·{' '}
            {formatCount(row.photos)} fotos · {formatCents(row.revenueCents)} em vendas
            pagas
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="delete-studio-confirm">
            Digite <span className="font-mono">{expected}</span> para confirmar
          </Label>
          <Input
            id="delete-studio-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={deleting}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={deleting}
            disabled={!canDelete || deleting}
            onClick={onDelete}
          >
            Excluir tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperationsCard({
  loading,
  docs,
  storageBytes,
  orders,
  photos,
}: {
  loading: boolean;
  docs: number;
  storageBytes: number;
  orders: OrderDoc[];
  photos: PhotoDoc[];
}) {
  const signals = [
    {
      icon: Database,
      title: 'Firestore',
      value: loading ? null : `${formatCount(docs)} docs lidos no painel`,
      detail: 'Dados reais do produto em tempo real.',
      status: 'Conectado',
    },
    {
      icon: Cloud,
      title: 'Firebase Storage',
      value: loading ? null : formatBytes(storageBytes),
      detail: `${formatCount(photos.length)} originais com tamanho registrado.`,
      status: 'Estimado',
    },
    {
      icon: Server,
      title: 'Railway API',
      value: 'Uso a conectar',
      detail: 'Próximo passo: integrar métricas da API/healthcheck.',
      status: 'Pendente',
    },
    {
      icon: Gauge,
      title: 'Vercel',
      value: 'Deploys a conectar',
      detail: 'Próximo passo: integrar usage/deployments via Vercel API.',
      status: 'Pendente',
    },
  ];

  const paid = orders.filter((order) => order.status === 'paid').length;
  const pending = orders.filter((order) => order.status === 'pending').length;
  const carts = orders.filter((order) => order.status === 'cart').length;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-5">
        <h2 className="text-base font-semibold text-ink">Consumo e operação</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Infra, custos e sinais que precisam virar alertas.
        </p>
      </div>
      <div className="divide-y divide-border">
        {signals.map((signal) => (
          <div key={signal.title} className="flex gap-3 p-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <signal.icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">{signal.title}</p>
                <Badge
                  variant={signal.status === 'Conectado' ? 'success' : 'outline'}
                  className={signal.status === 'Pendente' ? 'bg-background' : undefined}
                >
                  {signal.status}
                </Badge>
              </div>
              {signal.value === null ? (
                <Skeleton className="mt-2 h-5 w-32" />
              ) : (
                <p className="mt-1 text-sm font-semibold text-ink">{signal.value}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 border-t border-border bg-muted/40 text-center">
        <SmallKpi label="Pagos" value={formatCount(paid)} />
        <SmallKpi label="Pendentes" value={formatCount(pending)} />
        <SmallKpi label="Leads" value={formatCount(carts)} />
      </div>
    </Card>
  );
}

function RecentUsersCard({
  loading,
  users,
  studios,
}: {
  loading: boolean;
  users: UserDoc[];
  studios: StudioDoc[];
}) {
  const studiosByOwner = new Map(studios.map((studio) => [studio.ownerId, studio]));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Usuários recentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Novas contas criadas no Photogrid.
          </p>
        </div>
        <Users className="size-5 text-muted-foreground" />
      </div>
      {loading ? (
        <LoadingRows />
      ) : users.length === 0 ? (
        <EmptyState text="Nenhum usuário encontrado." />
      ) : (
        <ul className="divide-y divide-border">
          {users.map((user) => {
            const studio = studiosByOwner.get(user.id);
            return (
              <li key={user.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.email}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {studio ? studio.name : 'Sem estúdio'} · {dateLabel(user.createdAt)}
                  </p>
                </div>
                {studio ? (
                  <Badge variant="success">
                    <BadgeCheck className="size-3" />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline">Onboarding</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentOrdersCard({
  loading,
  orders,
  studios,
}: {
  loading: boolean;
  orders: OrderDoc[];
  studios: StudioDoc[];
}) {
  const studiosById = new Map(studios.map((studio) => [studio.id, studio]));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Vendas recentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos finalizados ou aguardando confirmação.
          </p>
        </div>
        <LineChart className="size-5 text-muted-foreground" />
      </div>
      {loading ? (
        <LoadingRows />
      ) : orders.length === 0 ? (
        <EmptyState text="Nenhum pedido registrado." />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => {
            const studio = studiosById.get(order.studioId);
            return (
              <li key={order.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.customerName || order.customerPhone}
                    </p>
                    <OrderBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {studio?.name ?? order.studioSlug} · {order.galleryTitle} ·{' '}
                    {dateLabel(order.updatedAt || order.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {formatCents(order.totalCents)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
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
  return <Badge variant="outline">{statusLabel(status)}</Badge>;
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-xs">
      <span className="font-medium text-foreground">{formatCount(value)}</span>{' '}
      {label.toLowerCase()}
    </p>
  );
}

function SmallKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border p-3 last:border-r-0">
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
      <Sparkles className="size-5" />
      {text}
    </div>
  );
}

function buildStudioRows({
  studios,
  users,
  galleries,
  albums,
  photos,
  orders,
  clients,
}: {
  studios: StudioDoc[];
  users: UserDoc[];
  galleries: GalleryDoc[];
  albums: AlbumDoc[];
  photos: PhotoDoc[];
  orders: OrderDoc[];
  clients: ClientDoc[];
}): StudioRow[] {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return studios
    .map((studio) => {
      const studioGalleries = galleries.filter(
        (gallery) => gallery.studioId === studio.id,
      );
      const studioAlbums = albums.filter((album) => album.studioId === studio.id);
      const studioPhotos = photos.filter((photo) => photo.studioId === studio.id);
      const studioOrders = orders.filter((order) => order.studioId === studio.id);
      const studioClients = clients.filter((client) => client.studioId === studio.id);
      const paidOrders = studioOrders.filter((order) => order.status === 'paid');
      const pendingOrders = studioOrders.filter((order) => order.status === 'pending');
      const carts = studioOrders.filter((order) => order.status === 'cart');

      return {
        studio,
        owner: usersById.get(studio.ownerId) ?? null,
        galleries: studioGalleries.length,
        albums: studioAlbums.length,
        photos: studioPhotos.length,
        clients: studioClients.length,
        orders: studioOrders.filter((order) => order.status !== 'cart').length,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        carts: carts.length,
        revenueCents: paidOrders.reduce((sum, order) => sum + order.totalCents, 0),
        pendingCents: pendingOrders.reduce(
          (sum, order) => sum + order.totalCents,
          0,
        ),
        storageBytes: studioPhotos.reduce(
          (sum, photo) => sum + (photo.bytes ?? 0),
          0,
        ),
      };
    })
    .sort(
      (a, b) => {
        if (isTestStudio(a.studio) !== isTestStudio(b.studio)) {
          return isTestStudio(a.studio) ? 1 : -1;
        }
        return (
          b.revenueCents + b.pendingCents + b.storageBytes / 1000 -
          (a.revenueCents + a.pendingCents + a.storageBytes / 1000)
        );
      },
    );
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

