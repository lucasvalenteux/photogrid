'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

import { effectiveVisibility, ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

import { ClusterSuggestions } from '@/components/dashboard/cluster-suggestions';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { CoverCard } from '@/components/dashboard/cover-card';
import { CreateAlbumDialog } from '@/components/dashboard/create-album-dialog';
import { EditGalleryDialog } from '@/components/dashboard/edit-gallery-dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import { EntityActions } from '@/components/dashboard/entity-actions';
import { VisibilityBadge } from '@/components/dashboard/visibility-selector';
import { PhotoGrid } from '@/components/photos/photo-grid';
import {
  PhotoUploaderProgress,
  PhotoUploaderTile,
  usePhotoUploader,
} from '@/components/photos/photo-uploader';
import { useAuth } from '@/lib/hooks/use-auth';
import { subscribeToAlbums } from '@/lib/services/album-service';
import {
  consolidateClusters,
  isFaceClusteringEnabled,
  reprocessGalleryPhotos,
  subscribeToOpenClusters,
} from '@/lib/services/face-clustering-service';
import {
  deleteGallery,
  getGallery,
  reconcileGalleryCounters,
} from '@/lib/services/gallery-service';
import { subscribeToGalleryPhotos } from '@/lib/services/photo-service';
import {
  effectiveFaceClusteringEnabled,
  type AlbumDoc,
  type FaceClusterDoc,
  type GalleryDoc,
  type PhotoDoc,
} from '@/types';

function photoCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'foto' : 'fotos'}`;
}

function useGalleryShareUrl(slug: string | undefined, galleryId: string) {
  return React.useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return ROUTES.publicGallery(slug, galleryId);
    return `${window.location.origin}${ROUTES.publicGallery(slug, galleryId)}`;
  }, [slug, galleryId]);
}

export default function GalleryDetailPage() {
  const params = useParams<{ galleryId: string }>();
  const galleryId = params.galleryId;
  const router = useRouter();

  const { studio } = useAuth();
  const [gallery, setGallery] = React.useState<GalleryDoc | null>(null);
  const [albums, setAlbums] = React.useState<AlbumDoc[]>([]);
  const [photos, setPhotos] = React.useState<PhotoDoc[]>([]);
  const [clusters, setClusters] = React.useState<FaceClusterDoc[]>([]);
  const [loadingGallery, setLoadingGallery] = React.useState(true);
  const [loadingAlbums, setLoadingAlbums] = React.useState(true);
  const [loadingPhotos, setLoadingPhotos] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const reloadGallery = React.useCallback(async () => {
    const next = await getGallery(galleryId);
    setGallery(next);
  }, [galleryId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingGallery(true);
    getGallery(galleryId)
      .then((next) => {
        if (!cancelled) setGallery(next);
      })
      .finally(() => {
        if (!cancelled) setLoadingGallery(false);
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId]);

  React.useEffect(() => {
    setLoadingAlbums(true);
    const unsubscribe = subscribeToAlbums(
      galleryId,
      (next) => {
        setAlbums(next);
        setLoadingAlbums(false);
      },
      (error) => {
        console.error('[albums] subscription error', error);
        setLoadingAlbums(false);
      },
    );
    return () => unsubscribe();
  }, [galleryId]);

  React.useEffect(() => {
    setLoadingPhotos(true);
    const unsubscribe = subscribeToGalleryPhotos(
      galleryId,
      (next) => {
        setPhotos(next);
        setLoadingPhotos(false);
      },
      (error) => {
        console.error('[photos] subscription error', error);
        setLoadingPhotos(false);
      },
    );
    return () => unsubscribe();
  }, [galleryId]);

  // Face-clustering suggestions. We skip entirely when:
  //   - the API URL isn't configured (no backend deployed), or
  //   - the studio owner has the toggle off in /dashboard/settings.
  // When the toggle flips, this effect re-runs and either subscribes or
  // tears down cleanly, so the UI reflects the new state immediately.
  const faceClusteringActive =
    isFaceClusteringEnabled() && effectiveFaceClusteringEnabled(studio);

  React.useEffect(() => {
    if (!faceClusteringActive || !studio) {
      setClusters([]);
      return;
    }
    const unsubscribe = subscribeToOpenClusters(
      studio.id,
      galleryId,
      setClusters,
      (error) => console.error('[face-clustering] subscription error', error),
    );
    return () => unsubscribe();
  }, [galleryId, faceClusteringActive, studio]);

  const shareUrl = useGalleryShareUrl(studio?.slug, galleryId);
  const isOwner = Boolean(studio && gallery && studio.id === gallery.studioId);
  const galleryVisibility = effectiveVisibility(gallery?.visibility);

  // Indexed by id so the cluster suggestion rows / dialog can resolve
  // photoIds → thumbnail URL without firing additional Firestore reads.
  // Recomputed only when the photos array reference changes (subscription
  // emits a new array on every snapshot, so this matches the cadence).
  const photosById = React.useMemo(
    () => new Map(photos.map((p) => [p.id, p])),
    [photos],
  );

  // Self-heal denormalised counters once we know the real numbers. Guarded
  // by isOwner so visitors don't try to write — and the service no-ops when
  // everything already matches, so this is cheap on every navigation.
  React.useEffect(() => {
    if (!gallery || !isOwner) return;
    if (loadingPhotos || loadingAlbums) return;
    const firstPhoto = photos[0];
    const realCover = firstPhoto?.thumbnailUrl ?? firstPhoto?.imageUrl ?? null;
    void reconcileGalleryCounters({
      galleryId: gallery.id,
      photoCount: photos.length,
      albumCount: albums.length,
      coverPhotoUrl: realCover,
      current: {
        photoCount: gallery.photoCount,
        albumCount: gallery.albumCount,
        coverPhotoUrl: gallery.coverPhotoUrl ?? null,
      },
    });
  }, [gallery, isOwner, loadingPhotos, loadingAlbums, photos, albums]);

  const uploader = usePhotoUploader({ galleryId });
  const uploadingCount = uploader.queue.filter(
    (item) => item.status === 'queued' || item.status === 'uploading',
  ).length;

  // Manual reprocess — useful for galleries that were uploaded before the
  // AI backend went live, since those photos never hit the queue. Toast
  // shows running progress so the photographer knows it's working.
  const [reprocessing, setReprocessing] = React.useState(false);
  const onReprocess = async () => {
    if (reprocessing || photos.length === 0) return;
    setReprocessing(true);
    const toastId = toast.loading(
      `Reprocessando 0 de ${photos.length} fotos…`,
    );
    try {
      const result = await reprocessGalleryPhotos(photos, (progress) => {
        toast.loading(
          `Reprocessando ${progress.queued + progress.failed} de ${progress.total} fotos…`,
          { id: toastId },
        );
      });
      if (result.failed === 0) {
        toast.success(
          `${result.queued} fotos enviadas para análise. As sugestões aparecem em segundos.`,
          { id: toastId },
        );
      } else {
        toast.warning(
          `${result.queued} enviadas, ${result.failed} falharam. Tente novamente em alguns segundos.`,
          { id: toastId },
        );
      }
    } catch (error) {
      console.error('[face-clustering] reprocess error', error);
      toast.error('Não foi possível reprocessar agora.', { id: toastId });
    } finally {
      setReprocessing(false);
    }
  };

  // Manual consolidation — folds clusters whose centroids drifted close
  // enough to be the same person. Cheap on the API side (no model
  // inference, just dot products), so a button is a nicer UX than
  // waiting for the next upload to trigger it implicitly.
  const [consolidating, setConsolidating] = React.useState(false);
  const onConsolidate = async () => {
    if (consolidating || clusters.length < 2) return;
    setConsolidating(true);
    try {
      const result = await consolidateClusters(galleryId);
      if (result.merged === 0) {
        toast.info('Nada a consolidar — as pessoas já estão bem separadas.');
      } else {
        toast.success(
          `${result.merged} ${result.merged === 1 ? 'duplicado' : 'duplicados'} mesclado(s) automaticamente.`,
        );
      }
    } catch (error) {
      console.error('[face-clustering] consolidate error', error);
      const message =
        error instanceof Error ? error.message : 'Falha ao consolidar.';
      toast.error(message);
    } finally {
      setConsolidating(false);
    }
  };

  const onDeleteConfirmed = async () => {
    await deleteGallery(galleryId);
    toast.success('Galeria excluída.');
    router.push(ROUTES.galleries);
  };

  if (!loadingGallery && gallery === null) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href={ROUTES.galleries}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Galerias
        </Link>
        <EmptyState
          icon={Users}
          title="Galeria não encontrada."
          description="Ela pode ter sido removida. Volte para a lista de galerias."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Link
        href={ROUTES.galleries}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Todas as galerias
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {gallery?.title ?? 'Carregando…'}
            </h1>
            {gallery && galleryVisibility !== 'public' ? (
              <VisibilityBadge visibility={galleryVisibility} />
            ) : null}
          </div>
          {gallery?.description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {gallery.description}
            </p>
          ) : null}
        </div>

        {isOwner && gallery ? (
          <EntityActions
            shareUrl={shareUrl}
            shareLabel="Link da galeria"
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        ) : null}
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Fotos
          </h2>
          <span className="text-xs text-muted-foreground">
            {photoCountLabel(photos.length)}
          </span>
        </div>

        {loadingPhotos ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {isOwner ? (
              <PhotoUploaderTile
                onSelect={uploader.enqueueFiles}
                uploadingCount={uploadingCount}
              />
            ) : null}
            <PhotoGrid photos={photos} canDelete={Boolean(isOwner)} embedded />
          </div>
        )}
      </section>

      {isOwner && faceClusteringActive && gallery ? (
        <ClusterSuggestions
          clusters={clusters}
          galleryTitle={gallery.title}
          photosById={photosById}
          onReprocess={photos.length > 0 ? onReprocess : undefined}
          reprocessing={reprocessing}
          onConsolidate={onConsolidate}
          consolidating={consolidating}
          photoCount={photos.length}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Álbuns
          </h2>
          {isOwner ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={photos.length === 0}
            >
              <Plus className="size-4" />
              Novo álbum
            </Button>
          ) : null}
        </div>

        {loadingAlbums ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-64 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum álbum criado."
            description={
              photos.length === 0
                ? 'Suba algumas fotos antes para conseguir montar um álbum.'
                : isOwner
                  ? 'Crie um álbum para cada cliente e selecione as fotos que ele vai receber.'
                  : 'Esta galeria ainda não tem álbuns publicados.'
            }
            actionLabel={isOwner && photos.length > 0 ? 'Criar primeiro álbum' : undefined}
            onAction={
              isOwner && photos.length > 0 ? () => setCreateOpen(true) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => {
              const visibility = effectiveVisibility(album.visibility);
              return (
                <CoverCard
                  key={album.id}
                  href={ROUTES.album(galleryId, album.id)}
                  title={album.title}
                  coverUrl={album.coverPhotoUrl ?? null}
                  meta={photoCountLabel(album.photoIds.length)}
                  topRight={
                    visibility !== 'public' ? (
                      <VisibilityBadge visibility={visibility} />
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {isOwner ? (
        <PhotoUploaderProgress
          queue={uploader.queue}
          onDismissSettled={uploader.dismissSettled}
        />
      ) : null}

      <CreateAlbumDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        galleryId={galleryId}
      />

      {gallery ? (
        <EditGalleryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          gallery={gallery}
          onSaved={reloadGallery}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir galeria?"
        description={(() => {
          const parts: string[] = [];
          if (albums.length > 0) {
            parts.push(`${albums.length} ${albums.length === 1 ? 'álbum' : 'álbuns'}`);
          }
          if (photos.length > 0) {
            parts.push(`${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`);
          }
          if (parts.length === 0) return 'Esta ação não pode ser desfeita.';
          return `Esta galeria tem ${parts.join(' e ')}. Excluí-la não remove o conteúdo filho automaticamente — limpe antes para apagar tudo.`;
        })()}
        confirmLabel="Excluir galeria"
        tone="destructive"
        onConfirm={onDeleteConfirmed}
      />
    </div>
  );
}
