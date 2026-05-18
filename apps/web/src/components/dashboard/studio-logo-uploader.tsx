'use client';

import * as React from 'react';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button, cn } from '@photogrid/ui';

import {
  removeStudioLogo,
  updateStudioLogo,
} from '@/lib/services/studio-service';
import type { StudioDoc } from '@/types';

interface StudioLogoUploaderProps {
  studio: Pick<StudioDoc, 'id' | 'name' | 'logoUrl' | 'logoStoragePath'>;
}

// The avatar is shown at ~36-44px in the storefront header, but we store
// at 256×256 so it stays crisp on retina + leaves headroom for future
// uses (emails, social cards). The file ends up around 20-30 KB after
// JPEG compression, which is cheaper than gzipped SVGs in most cases.
const TARGET_EDGE = 256;
const JPEG_QUALITY = 0.86;
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Square logo uploader rendered inside the Estúdio settings card.
 * Behavior:
 *   1. Click on the avatar (or the "Trocar logo" button) opens a file
 *      picker filtered to image/*.
 *   2. We load the file into an Image, center-crop the shorter axis,
 *      resize the result down to TARGET_EDGE × TARGET_EDGE via canvas,
 *      and re-encode as JPEG. No external dependencies.
 *   3. The blob hits Firebase Storage, the resulting URL + path land
 *      in the Firestore studio doc, and any previous Storage object
 *      gets deleted (best-effort).
 *
 * Errors during any step roll back the local preview and surface a
 * toast. Optimistic updates aren't necessary — the upload is fast
 * enough that the "Salvando…" state never overstays its welcome.
 */
export function StudioLogoUploader({ studio }: StudioLogoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState<'uploading' | 'removing' | null>(null);

  const initial = React.useMemo(() => {
    const seed = (studio.name ?? '?').trim().charAt(0).toUpperCase();
    return seed || '?';
  }, [studio.name]);

  const openPicker = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error('Arquivo muito grande (máx. 5 MB).');
      return;
    }

    setBusy('uploading');
    try {
      const blob = await prepareSquareJpeg(file);
      await updateStudioLogo({
        studioId: studio.id,
        blob,
        extension: 'jpg',
        previousStoragePath: studio.logoStoragePath ?? null,
      });
      toast.success('Logo atualizada.');
    } catch (error) {
      console.error('[studio-logo] upload failed', error);
      toast.error('Não foi possível salvar a logo. Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('removing');
    try {
      await removeStudioLogo({
        studioId: studio.id,
        previousStoragePath: studio.logoStoragePath ?? null,
      });
      toast.success('Logo removida.');
    } catch (error) {
      console.error('[studio-logo] remove failed', error);
      toast.error('Não foi possível remover. Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={openPicker}
        disabled={Boolean(busy)}
        className={cn(
          'group relative size-[100px] shrink-0 overflow-hidden rounded-lg border border-border bg-ink text-white shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          busy && 'cursor-wait',
        )}
        aria-label="Trocar logo do estúdio"
      >
        {studio.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={studio.logoUrl}
            alt={`Logo de ${studio.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Camera className="size-8" aria-hidden="true" />
            <span className="sr-only">{initial}</span>
          </div>
        )}
        <span
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/55 text-white opacity-0 transition-opacity',
            'group-hover:opacity-100 group-focus-visible:opacity-100',
            busy && 'opacity-100',
          )}
          aria-hidden="true"
        >
          {busy === 'uploading' ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Logo do estúdio</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Imagem quadrada, mínimo 100×100. Aparece ao lado do nome do
          estúdio na loja pública.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={openPicker}
            disabled={Boolean(busy)}
            className="h-8 gap-1.5 px-2 text-xs"
          >
            <ImagePlus className="size-3.5" />
            {studio.logoUrl ? 'Trocar logo' : 'Enviar logo'}
          </Button>
          {studio.logoUrl ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={Boolean(busy)}
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
            >
              <Trash2 className="size-3.5" />
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

/**
 * Center-crop a square out of the input image and downscale it to
 * TARGET_EDGE×TARGET_EDGE, returning a JPEG blob ready for upload.
 *
 * Two-stage downscale (drawImage twice) preserves sharpness on very
 * large inputs — browsers' single-step downscale is bilinear and
 * smears detail. The intermediate step uses the source's shorter edge
 * so we never up-sample.
 */
async function prepareSquareJpeg(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.floor((img.naturalWidth - side) / 2);
  const sy = Math.floor((img.naturalHeight - side) / 2);

  // Stage 1: copy the centered square at native resolution. This makes
  // the subsequent downscale's source a square, so the GPU/canvas path
  // can keep the image isotropic.
  const stage1 = document.createElement('canvas');
  stage1.width = side;
  stage1.height = side;
  const ctx1 = stage1.getContext('2d');
  if (!ctx1) throw new Error('Canvas indisponível.');
  ctx1.drawImage(img, sx, sy, side, side, 0, 0, side, side);

  // Stage 2: downscale to the target edge. We use imageSmoothingQuality
  // 'high' which is meaningful in Chrome/Edge for downsampling.
  const stage2 = document.createElement('canvas');
  stage2.width = TARGET_EDGE;
  stage2.height = TARGET_EDGE;
  const ctx2 = stage2.getContext('2d');
  if (!ctx2) throw new Error('Canvas indisponível.');
  ctx2.imageSmoothingEnabled = true;
  ctx2.imageSmoothingQuality = 'high';
  ctx2.drawImage(stage1, 0, 0, TARGET_EDGE, TARGET_EDGE);

  const blob = await new Promise<Blob | null>((resolve) =>
    stage2.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Falha ao gerar imagem.');
  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
