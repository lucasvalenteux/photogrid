'use client';

import * as React from 'react';
import {
  ChevronDown,
  Eye,
  Merge,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@photogrid/ui';

import {
  dismissCluster,
  promoteClusterToAlbum,
} from '@/lib/services/face-clustering-service';
import type { FaceClusterDoc, PhotoDoc } from '@/types';

interface ClusterSuggestionsProps {
  /** All open clusters for the current gallery, ordered by photo count desc. */
  clusters: FaceClusterDoc[];
  /** Used to derive the album title — e.g. "Colégio Santa Maria #01". */
  galleryTitle: string;
  /**
   * Indexed photos for the gallery, used to render mini thumb strips and
   * the "Ver fotos" dialog without firing additional queries. The parent
   * already subscribes to `subscribeToGalleryPhotos` so this is free.
   */
  photosById: Map<string, PhotoDoc>;
  /** Callback fired after a successful promotion (so the page can navigate). */
  onPromoted?: (albumId: string) => void;
  /**
   * Manual "reprocess all photos" handler. Surfaced as a button so the
   * owner can backfill clusters for photos uploaded before the AI
   * backend went live. Omit when there are no photos to reprocess.
   */
  onReprocess?: () => void;
  reprocessing?: boolean;
  /**
   * Manual "consolidate" handler — merges clusters whose centroids are
   * close enough to be the same person. Only meaningful when there's
   * more than one open cluster; the gallery page hides the button
   * otherwise.
   */
  onConsolidate?: () => void;
  consolidating?: boolean;
  /** Total photo count — used to gate the empty-state copy. */
  photoCount: number;
}

// Show this many suggestion rows by default; "Ver mais N" reveals the
// rest. Keeps the section tight even when the AI finds 30+ people, which
// happens often in school events.
const INITIAL_VISIBLE = 3;

/**
 * Album suggestion list rendered above the manual "Álbuns" section.
 * Each row represents a person the InsightFace pipeline saw across
 * multiple photos in the gallery — clicking "Criar álbum" delegates to
 * the API which atomically creates an Album from the cluster's photoIds.
 *
 * Renders an empty state with a "Reprocessar" button when face clustering
 * is enabled but no clusters exist yet — covers two cases:
 *   1. Photos uploaded before the AI backend was deployed (so they
 *      never hit the pipeline).
 *   2. The pipeline ran but no faces met the detection threshold.
 */
export function ClusterSuggestions({
  clusters,
  galleryTitle,
  photosById,
  onPromoted,
  onReprocess,
  reprocessing = false,
  onConsolidate,
  consolidating = false,
  photoCount,
}: ClusterSuggestionsProps) {
  const hasClusters = clusters.length > 0;
  const canConsolidate = clusters.length >= 2;

  const [expanded, setExpanded] = React.useState(false);
  // Reset the collapse state whenever the list shrinks below the threshold
  // (e.g. after a consolidation merges several clusters into one). Without
  // this, the "Ver mais" toggle could stay flipped even though it has
  // nothing to reveal.
  React.useEffect(() => {
    if (clusters.length <= INITIAL_VISIBLE) setExpanded(false);
  }, [clusters.length]);

  const visibleClusters = expanded
    ? clusters
    : clusters.slice(0, INITIAL_VISIBLE);
  const hiddenCount = clusters.length - visibleClusters.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-4 text-brand-500" />
          Sugestões automáticas
        </h2>
        <div className="flex items-center gap-3">
          {hasClusters ? (
            <span className="text-xs text-muted-foreground">
              {clusters.length}{' '}
              {clusters.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          ) : null}
          {onConsolidate && canConsolidate ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onConsolidate}
              disabled={consolidating || reprocessing}
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
              title="Mescla automaticamente pessoas iguais que apareceram separadas"
            >
              <Merge
                className={cn('size-3.5', consolidating && 'animate-pulse')}
              />
              {consolidating ? 'Consolidando…' : 'Consolidar pessoas'}
            </Button>
          ) : null}
          {onReprocess ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReprocess}
              disabled={reprocessing || consolidating}
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
            >
              <RefreshCw
                className={cn('size-3.5', reprocessing && 'animate-spin')}
              />
              {reprocessing ? 'Reprocessando…' : 'Reprocessar fotos'}
            </Button>
          ) : null}
        </div>
      </div>

      {hasClusters ? (
        <>
          <p className="text-xs text-muted-foreground">
            Detectamos grupos de fotos com a mesma pessoa. Crie um álbum
            com 1 clique e ajuste a seleção depois.
          </p>

          <ul className="space-y-2">
            {visibleClusters.map((cluster, index) => (
              <ClusterRow
                key={cluster.id}
                cluster={cluster}
                index={index}
                galleryTitle={galleryTitle}
                photosById={photosById}
                onPromoted={onPromoted}
              />
            ))}
          </ul>

          {hiddenCount > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(true)}
              className="h-8 w-full gap-1.5 text-xs text-muted-foreground"
            >
              <ChevronDown className="size-3.5" />
              Ver mais {hiddenCount}{' '}
              {hiddenCount === 1 ? 'sugestão' : 'sugestões'}
            </Button>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
          <p className="text-sm text-foreground">
            {photoCount === 0
              ? 'Suba fotos com pessoas para receber sugestões de álbuns automaticamente.'
              : 'Ainda não detectamos pessoas nas fotos desta galeria.'}
          </p>
          {photoCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Se você subiu as fotos antes da IA estar ativa, clique em
              <span className="font-medium"> &ldquo;Reprocessar fotos&rdquo;</span> para
              analisá-las agora.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Cluster row — compact horizontal layout                                  */
/* ------------------------------------------------------------------------ */

interface ClusterRowProps {
  cluster: FaceClusterDoc;
  index: number;
  galleryTitle: string;
  photosById: Map<string, PhotoDoc>;
  onPromoted?: (albumId: string) => void;
}

// Number of thumbnails shown inline next to the row. Anything past this
// is hinted with a "+N" pill; the user opens the dialog to see them all.
const INLINE_THUMBS = 4;

function ClusterRow({
  cluster,
  index,
  galleryTitle,
  photosById,
  onPromoted,
}: ClusterRowProps) {
  const [busy, setBusy] = React.useState<'promote' | 'dismiss' | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Album title is what the API would assign (and what the dialog shows
  // as a subtitle). Keeping the formatting here keeps the row and the
  // dialog in sync without a round trip.
  const suggestedTitle = `${galleryTitle} #${String(index + 1).padStart(2, '0')}`;

  // Resolve a few photos for the inline strip. We tolerate missing ids
  // (the photo could have been deleted) — Array.flatMap drops nulls.
  const inlinePhotos = cluster.photoIds
    .slice(0, INLINE_THUMBS)
    .flatMap((id) => {
      const photo = photosById.get(id);
      return photo ? [photo] : [];
    });
  const remaining = Math.max(0, cluster.photoCount - INLINE_THUMBS);

  const promote = async () => {
    if (busy) return;
    setBusy('promote');
    try {
      const result = await promoteClusterToAlbum({
        clusterId: cluster.id,
        galleryTitle,
      });
      toast.success('Álbum criado a partir da sugestão.');
      onPromoted?.(result.albumId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao criar álbum.';
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async () => {
    if (busy) return;
    setBusy('dismiss');
    try {
      await dismissCluster(cluster.id);
      toast.success('Sugestão descartada.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao descartar.';
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-2 shadow-xs transition-all sm:p-2.5 sm:pr-3',
        busy === 'dismiss' && 'opacity-50',
      )}
    >
      <FaceCrop
        cluster={cluster}
        className="size-12 shrink-0 rounded-full"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {cluster.photoCount}{' '}
          {cluster.photoCount === 1 ? 'foto' : 'fotos'}
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            #{String(index + 1).padStart(2, '0')}
          </span>
        </p>
        {inlinePhotos.length > 0 ? (
          <div className="mt-1.5 hidden items-center gap-1 sm:flex">
            {inlinePhotos.map((photo) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={photo.id}
                src={photo.thumbnailUrl ?? photo.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-8 rounded-md object-cover"
              />
            ))}
            {remaining > 0 ? (
              <span className="inline-flex h-8 items-center justify-center rounded-md bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                +{remaining}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPreviewOpen(true)}
          disabled={Boolean(busy)}
          className="h-8 gap-1.5 px-2 text-xs"
          aria-label="Ver fotos da sugestão"
        >
          <Eye className="size-3.5" />
          <span className="hidden sm:inline">Ver fotos</span>
        </Button>
        <Button
          size="sm"
          onClick={promote}
          loading={busy === 'promote'}
          disabled={busy === 'dismiss'}
          className="h-8 gap-1.5 px-2 text-xs"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Criar álbum</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          disabled={Boolean(busy)}
          aria-label="Descartar sugestão"
          className="size-8 p-0 text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ClusterPhotosDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        cluster={cluster}
        suggestedTitle={suggestedTitle}
        photosById={photosById}
        onPromote={promote}
        promoting={busy === 'promote'}
      />
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Cluster photos dialog — "Ver fotos"                                       */
/* ------------------------------------------------------------------------ */

interface ClusterPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: FaceClusterDoc;
  suggestedTitle: string;
  photosById: Map<string, PhotoDoc>;
  onPromote: () => Promise<void> | void;
  promoting: boolean;
}

function ClusterPhotosDialog({
  open,
  onOpenChange,
  cluster,
  suggestedTitle,
  photosById,
  onPromote,
  promoting,
}: ClusterPhotosDialogProps) {
  // Resolve photoIds → PhotoDoc, preserving the cluster's original order.
  // Missing ids (photo deleted after cluster was built) are silently
  // dropped — there's nothing useful we could render for them.
  const photos = React.useMemo(
    () =>
      cluster.photoIds.flatMap((id) => {
        const photo = photosById.get(id);
        return photo ? [photo] : [];
      }),
    [cluster.photoIds, photosById],
  );

  const handleCreate = async () => {
    await onPromote();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Pessoa em {cluster.photoCount}{' '}
            {cluster.photoCount === 1 ? 'foto' : 'fotos'}
          </DialogTitle>
          <DialogDescription>
            Sugestão para o álbum &ldquo;{suggestedTitle}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {photos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Não conseguimos carregar as fotos desta sugestão.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {photos.map((photo) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={photo.id}
                  src={photo.thumbnailUrl ?? photo.imageUrl}
                  alt={photo.fileName}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full rounded-md bg-muted object-cover"
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={promoting}
          >
            Fechar
          </Button>
          <Button onClick={handleCreate} loading={promoting}>
            Criar álbum com {photos.length}{' '}
            {photos.length === 1 ? 'foto' : 'fotos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* FaceCrop — uses background-position trick to crop without canvas         */
/* ------------------------------------------------------------------------ */

interface FaceCropProps {
  cluster: FaceClusterDoc;
  /**
   * Tailwind classes for the wrapper. Defaults to a square; the new
   * row layout passes `size-12 rounded-full` for a tight 48px avatar.
   */
  className?: string;
}

/**
 * Render the representative face by treating the full photo as a CSS
 * background and panning/zooming so the (padded) bbox fills the square.
 *
 *   1. Read the natural pixel dimensions once via `new Image()`.
 *   2. Pad the bbox by ~30% on each side for a flattering portrait crop.
 *   3. Compute a `background-size` + `background-position` pair that
 *      maps that crop window onto a 100%×100% container.
 *
 * Falls back to a plain object-cover thumbnail when there's no bbox or
 * we haven't measured the source yet.
 */
function FaceCrop({ cluster, className }: FaceCropProps) {
  const src =
    cluster.representativeThumbnailUrl ?? cluster.representativePhotoUrl;
  const [naturalSize, setNaturalSize] = React.useState<{
    w: number;
    h: number;
  } | null>(null);

  React.useEffect(() => {
    if (!src) {
      setNaturalSize(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const wrapperClass = cn(
    'aspect-square overflow-hidden bg-muted',
    className ?? 'w-full',
  );

  if (!src) {
    return (
      <div
        className={cn(wrapperClass, 'bg-gradient-to-br from-muted to-line')}
      />
    );
  }

  const bbox = cluster.representativeBbox;
  if (!bbox || bbox.length < 4 || !naturalSize) {
    return (
      <div className={cn('relative', wrapperClass)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const { w: imgW, h: imgH } = naturalSize;
  const x1 = bbox[0] ?? 0;
  const y1 = bbox[1] ?? 0;
  const x2 = bbox[2] ?? 0;
  const y2 = bbox[3] ?? 0;
  const faceW = Math.max(1, x2 - x1);
  const faceH = Math.max(1, y2 - y1);
  const pad = 0.3;
  const cropX1 = Math.max(0, x1 - faceW * pad);
  const cropY1 = Math.max(0, y1 - faceH * pad);
  const cropX2 = Math.min(imgW, x2 + faceW * pad);
  const cropY2 = Math.min(imgH, y2 + faceH * pad);
  const cropW = cropX2 - cropX1;
  const cropH = cropY2 - cropY1;

  // The image is sized so the crop region fully covers the square. Pick
  // the larger of the two ratios so the shorter edge fills.
  const scaleX = imgW / cropW;
  const scaleY = imgH / cropH;
  const scale = Math.max(scaleX, scaleY);
  const bgWidthPct = scale * 100;
  // Center the face inside the container.
  const containerInImgPxX = imgW / scale;
  const containerInImgPxY = imgH / scale;
  const maxOffsetX = imgW - containerInImgPxX;
  const maxOffsetY = imgH - containerInImgPxY;
  const desiredX = (cropX1 + cropX2) / 2 - containerInImgPxX / 2;
  const desiredY = (cropY1 + cropY2) / 2 - containerInImgPxY / 2;
  const clampedX = Math.max(0, Math.min(maxOffsetX, desiredX));
  const clampedY = Math.max(0, Math.min(maxOffsetY, desiredY));
  const posX = maxOffsetX > 0 ? (clampedX / maxOffsetX) * 100 : 50;
  const posY = maxOffsetY > 0 ? (clampedY / maxOffsetY) * 100 : 50;

  return (
    <div
      className={cn(wrapperClass, 'bg-no-repeat')}
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: `${bgWidthPct}% auto`,
        backgroundPosition: `${posX}% ${posY}%`,
      }}
      role="img"
      aria-label="Rosto detectado"
    />
  );
}
