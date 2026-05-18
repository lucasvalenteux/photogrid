'use client';

import * as React from 'react';

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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {photos.map((photo) => (
        <div key={photo.id} className="space-y-2">
          <ProtectedPhoto
            src={photo.thumbnailUrl ?? photo.imageUrl}
            fullSrc={photo.imageUrl}
            alt={photo.fileName}
            studioName={studio.name}
            studioUrl={studioUrl}
            security={security}
          />
          {showCart ? (
            <AddToCartButton
              size="sm"
              showPrice
              className="w-full"
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
          ) : null}
        </div>
      ))}
    </div>
  );
}
