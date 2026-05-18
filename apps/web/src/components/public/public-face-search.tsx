'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, Loader2, Search, Upload } from 'lucide-react';
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
    try {
      const result = await searchPublicFaces({ studioId: studio.id, file });
      setMatches(result);
      if (result.length === 0) {
        toast.info('Não encontramos fotos compatíveis com esse rosto.');
      }
    } catch (error) {
      console.error('[public-face-search] failed', error);
      toast.error('Não foi possível buscar agora.');
    } finally {
      setSearching(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
              <Search className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Encontre suas fotos pelo rosto
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Envie uma foto nítida do rosto da pessoa. Vamos procurar fotos e
                álbuns públicos deste estúdio com aparência compatível.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              disabled={searching}
              onClick={() => inputRef.current?.click()}
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {searching ? 'Buscando...' : 'Subir foto para buscar'}
            </Button>
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            A imagem enviada é usada apenas para a busca em tempo real. Ela não
            é publicada na loja.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {matches === null ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
              <Camera className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Os resultados aparecem aqui
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fotos e álbuns compatíveis serão listados depois do envio.
              </p>
            </div>
          ) : matchedPhotos.length === 0 && matchedAlbums.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
              <Search className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nenhum resultado encontrado
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente uma foto frontal, bem iluminada e com apenas uma pessoa.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {matchedAlbums.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Álbuns encontrados
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {matchedAlbums.slice(0, 6).map((album) => (
                      <Link
                        key={album.id}
                        href={ROUTES.publicAlbum(studio.slug, album.galleryId, album.id)}
                        className="rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {album.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {album.photoIds?.length ?? 0} fotos
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {matchedPhotos.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fotos encontradas
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {matchedPhotos.slice(0, 12).map((photo) => {
                      const gallery = galleriesById.get(photo.galleryId);
                      return (
                        <Link
                          key={photo.id}
                          href={
                            gallery
                              ? ROUTES.publicGallery(studio.slug, gallery.id)
                              : ROUTES.studio(studio.slug)
                          }
                          className="group space-y-2"
                        >
                          <ProtectedPhoto
                            src={photo.thumbnailUrl ?? photo.imageUrl}
                            alt={photo.fileName}
                            studioName={studio.name}
                            studioUrl={studioUrl}
                            studioLogoUrl={studio.logoUrl}
                            security={security}
                            interactive="none"
                          />
                          <p className="truncate text-xs text-muted-foreground">
                            {gallery?.title ?? 'Galeria'}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

