import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { ROUTES } from '@photogrid/config';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPublicAlbums,
  fetchPublicGallery,
  fetchPublicGalleryPhotos,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';
import { effectiveStudioSecurity } from '@/types';

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
  const security = effectiveStudioSecurity(studio);
  return {
    title: `${gallery.title} · ${studio.name}`,
    description: gallery.description ?? undefined,
    other: security.antiAi ? { robots: 'noai, noimageai' } : {},
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
  const security = effectiveStudioSecurity(studio);

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
                <ProtectedPhoto
                  key={photo.id}
                  src={photo.thumbnailUrl ?? photo.imageUrl}
                  fullSrc={photo.imageUrl}
                  alt={photo.fileName}
                  studioName={studio.name}
                  security={security}
                />
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
                  {album.coverPhotoUrl ? (
                    <ProtectedPhoto
                      src={album.coverPhotoUrl}
                      alt={album.title}
                      studioName={studio.name}
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
