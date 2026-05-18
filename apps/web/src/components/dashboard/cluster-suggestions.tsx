'use client';

import * as React from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button, cn } from '@photogrid/ui';

import {
  dismissCluster,
  promoteClusterToAlbum,
} from '@/lib/services/face-clustering-service';
import type { FaceClusterDoc } from '@/types';

interface ClusterSuggestionsProps {
  /** All open clusters for the current gallery, ordered by photo count desc. */
  clusters: FaceClusterDoc[];
  /** Used to derive the album title — e.g. "Colégio Santa Maria #01". */
  galleryTitle: string;
  /** Callback fired after a successful promotion (so the page can navigate). */
  onPromoted?: (albumId: string) => void;
  /**
   * Manual "reprocess all photos" handler. Surfaced as a button so the
   * owner can backfill clusters for photos uploaded before the AI
   * backend went live. Omit when there are no photos to reprocess.
   */
  onReprocess?: () => void;
  reprocessing?: boolean;
  /** Total photo count — used to gate the empty-state copy. */
  photoCount: number;
}

/**
 * Album suggestion strip rendered above the manual "Álbuns" section. Each
 * card represents a person the InsightFace pipeline saw across multiple
 * photos in the gallery. Clicking "Criar álbum" delegates to the API
 * which atomically creates an Album from the cluster's photoIds.
 *
 * Renders an empty state with a "Reprocessar" button when face clustering
 * is enabled but no clusters exist yet — covers two cases:
 *   1. Photos were uploaded before the AI backend was deployed (so they
 *      never hit the pipeline).
 *   2. The pipeline ran but no faces met the detection threshold.
 */
export function ClusterSuggestions({
  clusters,
  galleryTitle,
  onPromoted,
  onReprocess,
  reprocessing = false,
  photoCount,
}: ClusterSuggestionsProps) {
  const hasClusters = clusters.length > 0;

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
              {clusters.length} {clusters.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          ) : null}
          {onReprocess ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReprocess}
              disabled={reprocessing}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {clusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                galleryTitle={galleryTitle}
                onPromoted={onPromoted}
              />
            ))}
          </div>
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
/* Cluster card                                                              */
/* ------------------------------------------------------------------------ */

interface ClusterCardProps {
  cluster: FaceClusterDoc;
  galleryTitle: string;
  onPromoted?: (albumId: string) => void;
}

function ClusterCard({ cluster, galleryTitle, onPromoted }: ClusterCardProps) {
  const [busy, setBusy] = React.useState<'promote' | 'dismiss' | null>(null);

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
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all',
        busy === 'dismiss' && 'opacity-50',
      )}
    >
      <FaceCrop cluster={cluster} />
      <div className="space-y-2 p-3">
        <p className="text-xs font-medium text-foreground">
          {cluster.photoCount}{' '}
          {cluster.photoCount === 1 ? 'foto' : 'fotos'}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={promote}
            loading={busy === 'promote'}
            className="flex-1"
          >
            Criar álbum
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
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------------ */
/* FaceCrop — uses background-position trick to crop without canvas         */
/* ------------------------------------------------------------------------ */

interface FaceCropProps {
  cluster: FaceClusterDoc;
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
function FaceCrop({ cluster }: FaceCropProps) {
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

  if (!src) {
    return (
      <div className="aspect-square w-full bg-gradient-to-br from-muted to-line" />
    );
  }

  const bbox = cluster.representativeBbox;
  if (!bbox || bbox.length < 4 || !naturalSize) {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
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
  const scaleX = imgW / cropW; // background width as a multiple of the container
  const scaleY = imgH / cropH;
  const scale = Math.max(scaleX, scaleY);
  // After scaling, the container is `cropW * (scale/scaleX) × ...` wide.
  // We need to compute background-position as a percentage of the *extra*
  // space beyond the container. Using the standard formula:
  //   position% = offset / (bgSize - containerSize) * 100
  const bgWidthPct = scale * 100;
  const bgHeightPct = (scale * imgH) / imgW * (imgW / imgH) * 100; // ≡ scale * 100 since aspect preserved
  void bgHeightPct;
  // Offsets in "image pixels" — convert to a percentage of (bg - container)
  // by normalising against the container size (cropW/cropH after scaling).
  const containerInImgPxX = imgW / scale; // how many image px fit into one container width
  const containerInImgPxY = imgH / scale;
  const maxOffsetX = imgW - containerInImgPxX;
  const maxOffsetY = imgH - containerInImgPxY;
  // Center the face inside the container.
  const desiredX = (cropX1 + cropX2) / 2 - containerInImgPxX / 2;
  const desiredY = (cropY1 + cropY2) / 2 - containerInImgPxY / 2;
  const clampedX = Math.max(0, Math.min(maxOffsetX, desiredX));
  const clampedY = Math.max(0, Math.min(maxOffsetY, desiredY));
  const posX = maxOffsetX > 0 ? (clampedX / maxOffsetX) * 100 : 50;
  const posY = maxOffsetY > 0 ? (clampedY / maxOffsetY) * 100 : 50;

  return (
    <div
      className="aspect-square w-full bg-muted bg-no-repeat"
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
