import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { ROUTES } from '@photogrid/config';

import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPublicAlbums,
  fetchPublicGallery,
  fetchPublicGalleryPhotos,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';

interface Props {
  params: Promise<{ slug: string; galleryId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, galleryId } = await params;
  const [studio, gallery] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGallery(galleryId),
  ]);
  if (!studio || !gallery || gallery.studioId !== studio.id) {
    return { title: 'Galeria não encontrada' };
  }
  return {
    title: `${gallery.title} · ${studio.name}`,
    description: gallery.description ?? undefined,
  };
}

export default async function PublicGalleryPage({ params }: Props) {
  const { slug, galleryId } = await params;
  const [studio, gallery] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGallery(galleryId),
  ]);
  if (!studio || !gallery || gallery.studioId !== studio.id) notFound();

  const [albums, photos] = await Promise.all([
    fetchPublicAlbums(gallery.id),
    fetchPublicGalleryPhotos(gallery.id),
  ]);

  return (
    <StorefrontShell studio={studio}>
      <section className="container-app py-10 sm:py-14">
        <Link
          href={ROUTES.studio(studio.slug)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar para {studio.name}
        </Link>

        <header className="mt-6 max-w-2xl">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {gallery.title}
          </h1>
          {gallery.description ? (
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              {gallery.description}
            </p>
          ) : null}
        </header>

        <section className="mt-10 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Fotos
            </h2>
            <span className="text-xs text-muted-foreground">
              {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>

          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhuma foto publicada nesta galeria ainda.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <a
                    href={photo.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${photo.fileName} em nova aba`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailUrl ?? photo.imageUrl}
                      alt={photo.fileName}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </a>
                </figure>
              ))}
            </div>
          )}
        </section>

        {albums.length > 0 ? (
          <section className="mt-12 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Álbuns
              </h2>
              <span className="text-xs text-muted-foreground">
                {albums.length} {albums.length === 1 ? 'álbum' : 'álbuns'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <Link
                  key={album.id}
                  href={ROUTES.publicAlbum(studio.slug, gallery.id, album.id)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted">
                    {album.coverPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={album.coverPhotoUrl}
                        alt={album.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-line text-xs font-medium uppercase tracking-wide text-mute">
                        Sem capa
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-5">
                    <h2 className="text-base font-semibold tracking-tight text-ink">
                      {album.title}
                    </h2>
                    <p className="pt-2 text-xs text-muted-foreground">
                      {album.photoIds.length}{' '}
                      {album.photoIds.length === 1 ? 'foto' : 'fotos'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  );
}
