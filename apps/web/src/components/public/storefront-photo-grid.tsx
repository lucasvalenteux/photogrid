'use client';

import * as React from 'react';
import { FileImage, HardDrive, Maximize2, Ruler } from 'lucide-react';

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

import { ProtectedPhoto } from '@/components/public/protected-photo';
import type { PhotoDoc, StudioSecuritySettings } from '@/types';

import { AddToCartButton } from './add-to-cart-button';

interface StorefrontPhotoGridProps {
  photos: PhotoDoc[];
  studio: {
    id: string;
    name: string;
    slug: string;
  };
  studioUrl: string;
  security: Required<StudioSecuritySettings>;
  gallery: {
    id: string;
    title: string;
  };
  /**
   * Price (in cents) per photo. Resolved upstream by
   * `resolveGalleryPrices` so this component never has to read the
   * studio defaults.
   */
  pricePerPhotoCents: number;
}

/**
 * Client-only storefront grid that adds an "Adicionar ao carrinho"
 * action below each photo. The photo itself stays inside
 * `ProtectedPhoto` so the watermark / dim / anti-AI overlays are
 * unaffected.
 *
 * When the gallery has no configured photo price (zero), we hide the
 * button entirely instead of showing a "free" CTA — the studio
 * almost certainly forgot to set it up rather than meaning "free".
 */
export function StorefrontPhotoGrid({
  photos,
  studio,
  studioUrl,
  security,
  gallery,
  pricePerPhotoCents,
}: StorefrontPhotoGridProps) {
  const showCart = pricePerPhotoCents > 0;
  const [selectedPhoto, setSelectedPhoto] = React.useState<PhotoDoc | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {photos.map((photo) => (
          <div key={photo.id} className="space-y-2">
            <div className="relative">
              <ProtectedPhoto
                src={photo.thumbnailUrl ?? photo.imageUrl}
                fullSrc={photo.imageUrl}
                alt={photo.fileName}
                studioName={studio.name}
                studioUrl={studioUrl}
                security={security}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedPhoto(photo)}
                className={cn(
                  'absolute bottom-2 left-2 h-7 gap-1.5 rounded-full border-white/35 bg-black/55 px-2 text-[11px] text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/70',
                )}
                aria-label={`Ver detalhes de ${photo.fileName}`}
              >
                <Maximize2 className="size-3" />
                Detalhes
              </Button>
            </div>
            {showCart ? (
              <PhotoCartButton
                photo={photo}
                studio={studio}
                gallery={gallery}
                pricePerPhotoCents={pricePerPhotoCents}
                className="w-full"
              />
            ) : null}
          </div>
        ))}
      </div>

      <PublicPhotoDetailsDialog
        photo={selectedPhoto}
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhoto(null);
        }}
        studio={studio}
        studioUrl={studioUrl}
        security={security}
        gallery={gallery}
        pricePerPhotoCents={pricePerPhotoCents}
        showCart={showCart}
      />
    </>
  );
}

function PhotoCartButton({
  photo,
  studio,
  gallery,
  pricePerPhotoCents,
  className,
  size = 'sm',
}: {
  photo: PhotoDoc;
  studio: StorefrontPhotoGridProps['studio'];
  gallery: StorefrontPhotoGridProps['gallery'];
  pricePerPhotoCents: number;
  className?: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <AddToCartButton
      size={size}
      showPrice
      className={className}
      studioId={studio.id}
      studioSlug={studio.slug}
      payload={{
        galleryId: gallery.id,
        galleryTitle: gallery.title,
        item: {
          type: 'photo',
          itemId: photo.id,
          title: photo.fileName || 'Foto',
          thumbnailUrl: photo.thumbnailUrl ?? photo.imageUrl,
          priceCents: pricePerPhotoCents,
          photoCount: null,
        },
      }}
    />
  );
}

function PublicPhotoDetailsDialog({
  photo,
  open,
  onOpenChange,
  studio,
  studioUrl,
  security,
  gallery,
  pricePerPhotoCents,
  showCart,
}: {
  photo: PhotoDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: StorefrontPhotoGridProps['studio'];
  studioUrl: string;
  security: Required<StudioSecuritySettings>;
  gallery: StorefrontPhotoGridProps['gallery'];
  pricePerPhotoCents: number;
  showCart: boolean;
}) {
  if (!photo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-[320px] items-center justify-center bg-ink p-3 sm:p-4">
            <ProtectedPhoto
              src={photo.imageUrl}
              alt="Foto selecionada"
              studioName={studio.name}
              studioUrl={studioUrl}
              security={security}
              interactive="none"
              fit="contain"
              aspect="min-h-[320px] h-full"
              className="w-full max-w-full rounded-lg"
            />
          </div>

          <aside className="space-y-5 p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle>Detalhes da foto</DialogTitle>
              <DialogDescription>
                Confira as informações básicas antes de adicionar ao carrinho.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <InfoRow
                icon={Ruler}
                label="Dimensão"
                value={formatDimensions(photo)}
                detail={formatMegapixels(photo)}
              />
              <InfoRow
                icon={HardDrive}
                label="Peso"
                value={formatBytes(photo.bytes)}
              />
              <InfoRow
                icon={FileImage}
                label="Arquivo"
                value={photo.contentType ?? 'Imagem'}
                detail={fileExtension(photo.fileName)}
              />
            </div>

            <DialogFooter className="gap-2 border-t border-border pt-4">
              {showCart ? (
                <PhotoCartButton
                  photo={photo}
                  studio={studio}
                  gallery={gallery}
                  pricePerPhotoCents={pricePerPhotoCents}
                  size="lg"
                  className="w-full sm:w-auto"
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">
          {value}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatDimensions(photo: PhotoDoc): string {
  if (!photo.width || !photo.height) return 'Não informado';
  return `${photo.width} × ${photo.height}px`;
}

function formatMegapixels(photo: PhotoDoc): string {
  if (!photo.width || !photo.height) return 'Megapixels não informados';
  const mp = (photo.width * photo.height) / 1_000_000;
  return `${mp.toFixed(mp >= 10 ? 1 : 2)} MP`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Não informado';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function fileExtension(fileName: string): string {
  const extension = fileName.split('.').pop();
  return extension ? `.${extension.toLowerCase()}` : 'Extensão não informada';
}
