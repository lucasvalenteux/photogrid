'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Image as ImageIcon, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

import { effectiveVisibility, ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { EditAlbumDialog } from '@/components/dashboard/edit-album-dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import { EntityActions } from '@/components/dashboard/entity-actions';
import { PhotoSelectorDialog } from '@/components/dashboard/photo-selector-dialog';
import { VisibilityBadge } from '@/components/dashboard/visibility-selector';
import { PhotoGrid } from '@/components/photos/photo-grid';
import { useAuth } from '@/lib/hooks/use-auth';
import { deleteAlbum, getAlbum } from '@/lib/services/album-service';
import { subscribeToGalleryPhotos } from '@/lib/services/photo-service';
import type { AlbumDoc, PhotoDoc } from '@/types';

function useAlbumShareUrl(slug: string | undefined, galleryId: string, albumId: string) {
  return React.useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return ROUTES.publicAlbum(slug, galleryId, albumId);
    return `${window.location.origin}${ROUTES.publicAlbum(slug, galleryId, albumId)}`;
  }, [slug, galleryId, albumId]);
}

export default function AlbumDetailPage() {
  const params = useParams<{ galleryId: string; albumId: string }>();
  const { galleryId, albumId } = params;
  const router = useRouter();
  const { studio } = useAuth();

  const [album, setAlbum] = React.useState<AlbumDoc | null>(null);
  const [galleryPhotos, setGalleryPhotos] = React.useState<PhotoDoc[]>([]);
  const [loadingAlbum, setLoadingAlbum] = React.useState(true);
  const [loadingPhotos, setLoadingPhotos] = React.useState(true);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const reloadAlbum = React.useCallback(async () => {
    const next = await getAlbum(albumId);
    setAlbum(next);
  }, [albumId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingAlbum(true);
    getAlbum(albumId)
      .then((next) => {
        if (!cancelled) setAlbum(next);
      })
      .finally(() => {
        if (!cancelled) setLoadingAlbum(false);
      });
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  // We subscribe to the parent gallery's photo list because we need it both
  // to render the album (resolve photoIds → photos) AND to power the
  // selector dialog without re-fetching.
  React.useEffect(() => {
    setLoadingPhotos(true);
    const unsubscribe = subscribeToGalleryPhotos(
      galleryId,
      (next) => {
        setGalleryPhotos(next);
        setLoadingPhotos(false);
      },
      (error) => {
        console.error('[photos] subscription error', error);
        setLoadingPhotos(false);
      },
    );
    return () => unsubscribe();
  }, [galleryId]);

  const albumPhotos = React.useMemo<PhotoDoc[]>(() => {
    if (!album) return [];
    const byId = new Map(galleryPhotos.map((p) => [p.id, p]));
    return album.photoIds.map((id) => byId.get(id)).filter((p): p is PhotoDoc => Boolean(p));
  }, [album, galleryPhotos]);

  const shareUrl = useAlbumShareUrl(studio?.slug, galleryId, albumId);
  const isOwner = Boolean(studio && album && studio.id === album.studioId);

  const onDeleteConfirmed = async () => {
    await deleteAlbum(albumId, galleryId);
    toast.success('Álbum excluído.');
    router.push(ROUTES.gallery(galleryId));
  };

  if (!loadingAlbum && album === null) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href={ROUTES.gallery(galleryId)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Link>
        <EmptyState
          icon={ImageIcon}
          title="Álbum não encontrado."
          description="Volte para a galeria para criar um novo álbum."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Link
        href={ROUTES.gallery(galleryId)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para a galeria
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {album?.title ?? 'Carregando…'}
            </h1>
            {album && effectiveVisibility(album.visibility) !== 'public' ? (
              <VisibilityBadge visibility={effectiveVisibility(album.visibility)} />
            ) : null}
          </div>
        </div>
        {isOwner ? (
          <div className="flex items-center gap-2">
            <EntityActions
              shareUrl={shareUrl}
              shareLabel="Link do álbum"
              onEdit={() => setEditOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
            <Button onClick={() => setSelectorOpen(true)}>
              <ImagePlus className="size-4" />
              {album && album.photoIds.length > 0 ? 'Editar seleção' : 'Selecionar fotos'}
            </Button>
          </div>
        ) : null}
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Fotos do álbum
          </h2>
          <span className="text-xs text-muted-foreground">
            {albumPhotos.length} {albumPhotos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </div>

        {loadingAlbum || loadingPhotos ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : albumPhotos.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="Nenhuma foto selecionada."
            description={
              galleryPhotos.length === 0
                ? 'Não há fotos na galeria para escolher. Volte para a galeria e suba algumas fotos antes.'
                : isOwner
                  ? 'Use o botão acima para escolher quais fotos da galeria fazem parte deste álbum.'
                  : 'Este álbum ainda está vazio.'
            }
            actionLabel={
              isOwner && galleryPhotos.length > 0 ? 'Selecionar fotos' : undefined
            }
            onAction={
              isOwner && galleryPhotos.length > 0 ? () => setSelectorOpen(true) : undefined
            }
          />
        ) : (
          <PhotoGrid photos={albumPhotos} />
        )}
      </section>

      {album ? (
        <PhotoSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          albumId={album.id}
          galleryPhotos={galleryPhotos}
          initialSelectedIds={album.photoIds}
          onSaved={reloadAlbum}
        />
      ) : null}

      {album ? (
        <EditAlbumDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          album={album}
          onSaved={reloadAlbum}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir álbum?"
        description={
          album && album.photoIds.length > 0
            ? `Este álbum tem ${album.photoIds.length} ${
                album.photoIds.length === 1 ? 'foto selecionada' : 'fotos selecionadas'
              }. Excluí-lo não apaga as fotos da galeria — só esta seleção.`
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir álbum"
        tone="destructive"
        onConfirm={onDeleteConfirmed}
      />
    </div>
  );
}
