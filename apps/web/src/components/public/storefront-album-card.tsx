'use client';

import Link from 'next/link';
import * as React from 'react';

import { ROUTES } from '@photogrid/config';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import type { AlbumDoc, StudioSecuritySettings } from '@/types';

import { AddToCartButton } from './add-to-cart-button';

interface StorefrontAlbumCardProps {
  album: AlbumDoc;
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
  pricePerAlbumCents: number;
}

/**
 * Card used on the storefront gallery page. We split the surface so
 * the cover photo still navigates to the album detail page (where the
 * visitor can browse every photo before buying), while the "Adicionar
 * ao carrinho" button is rendered below — clicking it stops
 * propagation and adds the whole album as a single OrderItem.
 */
export function StorefrontAlbumCard({
  album,
  studio,
  studioUrl,
  security,
  gallery,
  pricePerAlbumCents,
}: StorefrontAlbumCardProps) {
  const href = ROUTES.publicAlbum(studio.slug, gallery.id, album.id);
  const showCart = pricePerAlbumCents > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={href}
        className="group block"
        aria-label={`Abrir álbum ${album.title}`}
      >
        {album.coverPhotoUrl ? (
          <ProtectedPhoto
            src={album.coverPhotoUrl}
            alt={album.title}
            studioName={studio.name}
            studioUrl={studioUrl}
            security={security}
            interactive="none"
            aspect="aspect-[5/4]"
            className="rounded-none"
          />
        ) : (
          <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-line text-xs font-medium uppercase tracking-wide text-mute">
              Sem capa
            </div>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col justify-between gap-3 p-5">
        <Link href={href} className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {album.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {album.photoIds.length}{' '}
            {album.photoIds.length === 1 ? 'foto' : 'fotos'}
          </p>
        </Link>
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
                type: 'album',
                itemId: album.id,
                title: album.title,
                thumbnailUrl: album.coverPhotoUrl ?? null,
                priceCents: pricePerAlbumCents,
                photoCount: album.photoIds.length,
              },
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
