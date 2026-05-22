'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { fetchPhotosByIds } from '@/lib/services/public-service';
import { searchGalleryFaces } from '@/lib/services/face-clustering-service';
import {
  galleryFaceSearchStorageKey,
  type StoredGalleryFaceSearch,
} from '@/lib/gallery-face-search-storage';
import type {
  AlbumDoc,
  GalleryDoc,
  PhotoDoc,
  StudioDoc,
  StudioSecuritySettings,
} from '@/types';

import { GalleryFaceSearchGate } from './gallery-face-search-gate';
import { StorefrontAlbumCard } from './storefront-album-card';
import { StorefrontPhotoGrid } from './storefront-photo-grid';

interface GalleryFaceGatedViewProps {
  studio: Pick<StudioDoc, 'id' | 'name' | 'slug' | 'logoUrl'>;
  gallery: Pick<GalleryDoc, 'id' | 'title'>;
  studioUrl: string;
  security: Required<StudioSecuritySettings>;
  pricePerPhotoCents: number;
  pricePerAlbumCents: number;
  albums: AlbumDoc[];
}

export function GalleryFaceGatedView({
  studio,
  gallery,
  studioUrl,
  security,
  pricePerPhotoCents,
  pricePerAlbumCents,
  albums,
}: GalleryFaceGatedViewProps) {
  const [photoIds, setPhotoIds] = React.useState<string[] | null>(null);
  const [photos, setPhotos] = React.useState<PhotoDoc[]>([]);
  const [loadingPhotos, setLoadingPhotos] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const raw = window.sessionStorage.getItem(
      galleryFaceSearchStorageKey(gallery.id),
    );
    if (!raw) {
      setPhotoIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredGalleryFaceSearch;
      setPhotoIds(
        Array.isArray(parsed.photoIds)
          ? parsed.photoIds.filter((id): id is string => typeof id === 'string')
          : [],
      );
    } catch {
      setPhotoIds([]);
    }
  }, [gallery.id]);

  React.useEffect(() => {
    if (!photoIds || photoIds.length === 0) {
      setPhotos([]);
      setLoadingPhotos(false);
      return;
    }

    let cancelled = false;
    setLoadingPhotos(true);
    void fetchPhotosByIds(photoIds)
      .then((next) => {
        if (!cancelled) setPhotos(next);
      })
      .catch((error) => {
        console.error('[gallery-face-gated] failed to load photos', error);
        if (!cancelled) {
          toast.error('Não foi possível carregar as fotos encontradas.');
          setPhotos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPhotos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photoIds]);

  const matchedPhotoIds = React.useMemo(() => new Set(photoIds ?? []), [photoIds]);

  const matchedAlbums = React.useMemo(
    () =>
      albums.filter((album) =>
        (album.photoIds ?? []).some((photoId) => matchedPhotoIds.has(photoId)),
      ),
    [albums, matchedPhotoIds],
  );

  const onSearch = async (file: File) => {
    setSearching(true);
    setSearchError(null);
    try {
      const matches = await searchGalleryFaces({ galleryId: gallery.id, file });
      if (matches.length === 0) {
        toast.info('Não encontramos fotos compatíveis com esse rosto nesta galeria.');
        setPhotoIds([]);
        window.sessionStorage.removeItem(galleryFaceSearchStorageKey(gallery.id));
        return;
      }

      const ids = Array.from(new Set(matches.map((match) => match.photoId)));
      const payload: StoredGalleryFaceSearch = {
        photoIds: ids,
        savedAt: Date.now(),
      };
      window.sessionStorage.setItem(
        galleryFaceSearchStorageKey(gallery.id),
        JSON.stringify(payload),
      );
      setPhotoIds(ids);
    } catch (error) {
      console.error('[gallery-face-gated] search failed', error);
      const message =
        error instanceof Error && error.message.includes('404')
          ? 'Busca em atualização. Tente novamente em instantes.'
          : 'Não foi possível buscar agora.';
      setSearchError(message);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  };

  const unlocked = photoIds !== null && photoIds.length > 0;

  if (!unlocked) {
    return (
      <div className="mt-12 rounded-2xl border border-dashed border-border bg-card px-6 py-14 sm:py-16">
        <GalleryFaceSearchGate
          onSearch={onSearch}
          searching={searching}
          error={searchError}
        />
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Fotos encontradas
          </h2>
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.removeItem(
                galleryFaceSearchStorageKey(gallery.id),
              );
              setPhotoIds([]);
              setPhotos([]);
            }}
            className="text-xs font-medium text-brand-600 underline decoration-brand-600 underline-offset-4 hover:text-brand-700"
          >
            Nova busca
          </button>
        </div>

        {loadingPhotos ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            Carregando fotos…
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            Não encontramos fotos compatíveis. Tente outra imagem do rosto.
          </div>
        ) : (
          <StorefrontPhotoGrid
            photos={photos}
            studio={studio}
            studioUrl={studioUrl}
            security={security}
            gallery={gallery}
            pricePerPhotoCents={pricePerPhotoCents}
          />
        )}
      </section>

      {matchedAlbums.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Álbuns com fotos compatíveis
            </h2>
            <span className="text-xs text-muted-foreground">
              {matchedAlbums.length}{' '}
              {matchedAlbums.length === 1 ? 'álbum' : 'álbuns'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchedAlbums.map((album) => (
              <StorefrontAlbumCard
                key={album.id}
                album={album}
                studio={studio}
                studioUrl={studioUrl}
                security={security}
                gallery={gallery}
                pricePerAlbumCents={pricePerAlbumCents}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
