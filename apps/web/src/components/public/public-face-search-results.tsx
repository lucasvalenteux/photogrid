'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

import { publicFaceSearchStorageKey } from '@/lib/public-face-search-storage';
import type {
  AlbumDoc,
  GalleryDoc,
  PhotoDoc,
  StudioDoc,
  StudioSecuritySettings,
} from '@/types';
import { resolveGalleryPrices, securityForStorefrontCovers } from '@/types';

import { StorefrontAlbumCard } from './storefront-album-card';
import { StorefrontPhotoGrid } from './storefront-photo-grid';

interface PublicFaceSearchResultsProps {
  studio: StudioDoc;
  studioUrl: string;
  security: Required<StudioSecuritySettings>;
  photos: PhotoDoc[];
  albums: AlbumDoc[];
  galleries: GalleryDoc[];
}

export function PublicFaceSearchResults({
  studio,
  studioUrl,
  security,
  photos,
  albums,
  galleries,
}: PublicFaceSearchResultsProps) {
  const [photoIds, setPhotoIds] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    const raw = window.sessionStorage.getItem(publicFaceSearchStorageKey(studio.id));
    if (!raw) {
      setPhotoIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { photoIds?: unknown };
      setPhotoIds(
        Array.isArray(parsed.photoIds)
          ? parsed.photoIds.filter((id): id is string => typeof id === 'string')
          : [],
      );
    } catch {
      setPhotoIds([]);
    }
  }, [studio.id]);

  const galleriesById = React.useMemo(
    () => new Map(galleries.map((gallery) => [gallery.id, gallery])),
    [galleries],
  );

  const matchedPhotoIds = React.useMemo(() => new Set(photoIds ?? []), [photoIds]);
  const coverSecurity = React.useMemo(
    () => securityForStorefrontCovers(security),
    [security],
  );

  const matchedPhotos = React.useMemo(() => {
    if (!photoIds) return [];
    const photosById = new Map(photos.map((photo) => [photo.id, photo]));
    return photoIds
      .map((photoId) => photosById.get(photoId))
      .filter((photo): photo is PhotoDoc => Boolean(photo));
  }, [photoIds, photos]);

  const matchedAlbums = React.useMemo(
    () =>
      albums.filter((album) =>
        (album.photoIds ?? []).some((photoId) => matchedPhotoIds.has(photoId)),
      ),
    [albums, matchedPhotoIds],
  );

  const photosByGallery = React.useMemo(() => {
    const groups: Array<{ gallery: GalleryDoc; photos: PhotoDoc[] }> = [];
    const indexByGalleryId = new Map<string, number>();

    for (const photo of matchedPhotos) {
      const gallery = galleriesById.get(photo.galleryId);
      if (!gallery) continue;

      const existingIndex = indexByGalleryId.get(gallery.id);
      if (existingIndex === undefined) {
        indexByGalleryId.set(gallery.id, groups.length);
        groups.push({ gallery, photos: [photo] });
      } else {
        groups[existingIndex]?.photos.push(photo);
      }
    }

    return groups;
  }, [galleriesById, matchedPhotos]);

  if (photoIds === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        Carregando resultados...
      </div>
    );
  }

  if (photoIds.length === 0 || (matchedPhotos.length === 0 && matchedAlbums.length === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          Nenhum resultado de busca encontrado.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Volte para a loja e envie uma foto para iniciar uma nova busca.
        </p>
        <Button asChild className="mt-6">
          <Link href={ROUTES.studio(studio.slug)}>
            <ChevronLeft className="size-4" />
            Voltar para {studio.name}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {matchedAlbums.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Álbuns encontrados
            </h2>
            <span className="text-xs text-muted-foreground">
              {matchedAlbums.length}{' '}
              {matchedAlbums.length === 1 ? 'álbum' : 'álbuns'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchedAlbums.map((album) => {
              const gallery = galleriesById.get(album.galleryId);
              if (!gallery) return null;
              const prices = resolveGalleryPrices(gallery, studio);

              return (
                <StorefrontAlbumCard
                  key={album.id}
                  album={album}
                  studio={{
                    id: studio.id,
                    name: studio.name,
                    slug: studio.slug,
                    logoUrl: studio.logoUrl,
                  }}
                  studioUrl={studioUrl}
                  security={coverSecurity}
                  gallery={{ id: gallery.id, title: gallery.title }}
                  pricePerAlbumCents={prices.pricePerAlbumCents}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Fotos encontradas
          </h2>
          <span className="text-xs text-muted-foreground">
            {matchedPhotos.length} {matchedPhotos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </div>

        <div className="space-y-10">
          {photosByGallery.map(({ gallery, photos: galleryPhotos }) => {
            const prices = resolveGalleryPrices(gallery, studio);

            return (
              <div key={gallery.id} className="space-y-3">
                {photosByGallery.length > 1 ? (
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {gallery.title}
                  </h3>
                ) : null}
                <StorefrontPhotoGrid
                  photos={galleryPhotos}
                  studio={{
                    id: studio.id,
                    name: studio.name,
                    slug: studio.slug,
                    logoUrl: studio.logoUrl,
                  }}
                  studioUrl={studioUrl}
                  security={security}
                  gallery={{ id: gallery.id, title: gallery.title }}
                  pricePerPhotoCents={prices.pricePerPhotoCents}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
