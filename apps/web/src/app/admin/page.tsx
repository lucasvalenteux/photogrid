'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, LogOut, TestTube2 } from 'lucide-react';
import { onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Badge, Button, Card, Logo } from '@photogrid/ui';

import { AccountAccessLogger } from '@/components/admin/account-access-logger';
import { AdminAccountsSection } from '@/components/admin/admin-accounts-section';
import { AdminOverviewSection } from '@/components/admin/admin-overview-section';
import { AdminPlatformSettings } from '@/components/admin/admin-platform-settings';
import { DeleteAccountDialog } from '@/components/admin/delete-account-dialog';
import {
  DeleteStudioDialog,
  EditStudioDialog,
} from '@/components/admin/admin-studio-dialogs';
import type { AccountAdminDetail } from '@/lib/admin/metrics';
import { AdminStudiosSection } from '@/components/admin/admin-studios-section';
import { FullscreenLoader } from '@/components/common/fullscreen-loader';
import { isSystemAdmin } from '@/lib/admin/access';
import { formatCount } from '@/lib/admin/format';
import {
  buildAccountDetails,
  buildPlatformOverview,
  buildStudioDetails,
  type StudioAdminDetail,
} from '@/lib/admin/metrics';
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
import { useAuth } from '@/lib/hooks/use-auth';
import { subscribeToAccountAccessLogs } from '@/lib/services/account-access-log-service';
import {
  subscribeToPlatformSettings,
} from '@/lib/services/platform-settings-service';
import type {
  AccountAccessLogDoc,
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
  accessLogs: AccountAccessLogDoc[] | null;
};

type DataKey = keyof AdminData;

const INITIAL_DATA: AdminData = {
  users: null,
  studios: null,
  galleries: null,
  albums: null,
  photos: null,
  orders: null,
  clients: null,
  accessLogs: null,
};

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
  const [deletingStudio, setDeletingStudio] = React.useState<StudioAdminDetail | null>(
    null,
  );
  const [deletingAccount, setDeletingAccount] = React.useState<AccountAdminDetail | null>(
    null,
  );

  const loading = Object.values(data).some((value) => value === null);
  const users = data.users ?? [];
  const studios = data.studios ?? [];
  const galleries = data.galleries ?? [];
  const albums = data.albums ?? [];
  const photos = data.photos ?? [];
  const orders = data.orders ?? [];
  const clients = data.clients ?? [];
  const accessLogs = data.accessLogs ?? [];

  const overview = React.useMemo(
    () =>
      loading
        ? null
        : buildPlatformOverview({
            users,
            studios,
            galleries,
            albums,
            photos,
            orders,
            clients,
            accessLogs,
          }),
    [accessLogs, albums, clients, galleries, loading, orders, photos, studios, users],
  );

  const studioDetails = React.useMemo(
    () =>
      loading
        ? []
        : buildStudioDetails({
            studios,
            users,
            galleries,
            albums,
            photos,
            orders,
            clients,
          }),
    [albums, clients, galleries, loading, orders, photos, studios, users],
  );

  const accountDetails = React.useMemo(
    () =>
      loading ? [] : buildAccountDetails({ users, studios, accessLogs }),
    [accessLogs, loading, studios, users],
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.login);
  };

  return (
    <div className="min-h-dvh bg-background">
      <AccountAccessLogger event="admin_view" path="/admin" />

      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Administração
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Painel central do Photogrid — configuração global, resumo da
            plataforma, estúdios e contas.
          </p>
          {overview && overview.testStudios > 0 ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <TestTube2 className="size-3.5" />
              {formatCount(overview.testStudios)} estúdio(s) de teste fora do resumo
            </p>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Falha ao ler: {errors.join(', ')}. Publique as regras do Firestore
            (incluindo <code className="font-mono">accountAccessLogs</code>).
          </Card>
        ) : null}

        <AdminOverviewSection loading={loading} overview={overview} />

        <AdminStudiosSection
          loading={loading}
          studios={studioDetails}
          users={users}
          accessLogs={accessLogs}
          onEdit={setEditingStudio}
          onDelete={setDeletingStudio}
        />

        <AdminAccountsSection
          loading={loading}
          accounts={accountDetails}
          onDelete={setDeletingAccount}
        />

        <AdminPlatformSettings
          redirectHomeToAutoLogin={platformSettings.redirectHomeToAutoLogin}
          loading={loadingPlatformSettings}
          error={platformSettingsError}
          adminEmail={user?.email ?? ''}
        />
      </main>

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
      <DeleteAccountDialog
        account={deletingAccount}
        open={Boolean(deletingAccount)}
        onOpenChange={(open) => {
          if (!open) setDeletingAccount(null);
        }}
      />
    </div>
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
      subscribe: (
        onValue: (value: NonNullable<AdminData[K]>) => void,
        onError: (error: Error) => void,
      ) => Unsubscribe,
    ) => {
      unsubscribes.push(
        subscribe(
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
        ),
      );
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
    guarded('accessLogs', (onValue, onError) =>
      subscribeToAccountAccessLogs(onValue, onError),
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
      () => {
        setError(true);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { settings, loading, error };
}
