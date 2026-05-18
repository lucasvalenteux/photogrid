'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Button, Card } from '@photogrid/ui';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import {
  searchPublicFaces,
  type PublicFaceSearchMatch,
} from '@/lib/services/face-clustering-service';
import type {
  AlbumDoc,
  GalleryDoc,
  PhotoDoc,
  StudioSecuritySettings,
} from '@/types';

interface PublicFaceSearchProps {
  studio: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };
  studioUrl: string;
  security: Required<StudioSecuritySettings>;
  photos: PhotoDoc[];
  albums: AlbumDoc[];
  galleries: GalleryDoc[];
}

export function PublicFaceSearch({
  studio,
  studioUrl,
  security,
  photos,
  albums,
  galleries,
}: PublicFaceSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [searching, setSearching] = React.useState(false);
  const [matches, setMatches] = React.useState<PublicFaceSearchMatch[] | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const photosById = React.useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const galleriesById = React.useMemo(
    () => new Map(galleries.map((gallery) => [gallery.id, gallery])),
    [galleries],
  );
  const matchScoreByPhotoId = React.useMemo(
    () => new Map((matches ?? []).map((match) => [match.photoId, match.score])),
    [matches],
  );

  const matchedPhotos = React.useMemo(
    () =>
      (matches ?? [])
        .map((match) => photosById.get(match.photoId))
        .filter((photo): photo is PhotoDoc => Boolean(photo)),
    [matches, photosById],
  );

  const matchedAlbums = React.useMemo(
    () =>
      albums.filter((album) =>
        (album.photoIds ?? []).some((photoId) => matchScoreByPhotoId.has(photoId)),
      ),
    [albums, matchScoreByPhotoId],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem do rosto.');
      return;
    }

    setSearching(true);
    setMatches(null);
    setSearchError(null);
    try {
      const result = await searchPublicFaces({ studioId: studio.id, file });
      setMatches(result);
      if (result.length === 0) {
        toast.info('Não encontramos fotos compatíveis com esse rosto.');
      }
    } catch (error) {
      console.error('[public-face-search] failed', error);
      const message =
        error instanceof Error && error.message.includes('404')
          ? 'Busca em atualização. Tente novamente em instantes.'
          : 'Não foi possível buscar agora.';
      setSearchError(message);
      toast.error(message);
    } finally {
      setSearching(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full overflow-hidden p-3 shadow-xs lg:w-[360px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
            <Search className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">
              Buscar pelo rosto
            </h2>
            <p className="text-xs text-muted-foreground">
              Envie uma foto para encontrar imagens.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={searching}
          onClick={() => inputRef.current?.click()}
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {searching ? 'Buscando' : 'Enviar'}
        </Button>
      </div>

      {searchError ? (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {searchError}
        </p>
      ) : null}

      {matches !== null ? (
        <div className="mt-3 border-t border-border pt-3">
          {matchedPhotos.length === 0 && matchedAlbums.length === 0 ? (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Nenhum resultado encontrado.
            </p>
          ) : (
            <div className="space-y-4">
              {matchedAlbums.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Álbuns
                  </h3>
                  <div className="space-y-2">
                    {matchedAlbums.slice(0, 3).map((album) => (
                      <Link
                        key={album.id}
                        href={ROUTES.publicAlbum(studio.slug, album.galleryId, album.id)}
                        className="block rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-muted/50"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {album.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {album.photoIds?.length ?? 0} fotos
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {matchedPhotos.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Fotos
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {matchedPhotos.slice(0, 6).map((photo) => {
                      const gallery = galleriesById.get(photo.galleryId);
                      return (
                        <Link
                          key={photo.id}
                          href={
                            gallery
                              ? ROUTES.publicGallery(studio.slug, gallery.id)
                              : ROUTES.studio(studio.slug)
                          }
                          aria-label={gallery?.title ?? 'Abrir galeria'}
                        >
                          <ProtectedPhoto
                            src={photo.thumbnailUrl ?? photo.imageUrl}
                            alt={photo.fileName}
                            studioName={studio.name}
                            studioUrl={studioUrl}
                            studioLogoUrl={studio.logoUrl}
                            security={security}
                            interactive="none"
                            aspect="aspect-square"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

