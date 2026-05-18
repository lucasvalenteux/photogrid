import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { ROUTES } from '@photogrid/config';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPhotosByIds,
  fetchPublicAlbum,
  fetchPublicGallery,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';
import { effectiveStudioSecurity } from '@/types';

interface Props {
  params: Promise<{ slug: string; galleryId: string; albumId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, albumId } = await params;
  const [studio, album] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicAlbum(albumId),
  ]);
  if (!studio || !album || album.studioId !== studio.id) {
    return { title: 'Álbum não encontrado' };
  }
  return {
    title: `${album.title} · ${studio.name}`,
  };
}

export default async function PublicAlbumPage({ params }: Props) {
  const { slug, galleryId, albumId } = await params;
  const [studio, gallery, album] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGallery(galleryId),
    fetchPublicAlbum(albumId),
  ]);
  if (
    !studio ||
    !gallery ||
    !album ||
    gallery.studioId !== studio.id ||
    album.galleryId !== gallery.id
  ) {
    notFound();
  }

  const photos = await fetchPhotosByIds(album.photoIds);
  const security = effectiveStudioSecurity(studio);

  return (
    <StorefrontShell studio={studio}>
      <section className="container-app py-10 sm:py-14">
        <Link
          href={ROUTES.publicGallery(studio.slug, gallery.id)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {gallery.title}
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {album.title}
            </h1>
          </div>
          <span className="text-xs text-muted-foreground">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </header>

        <div className="mt-8">
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              As fotos deste álbum serão publicadas em breve.
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
        </div>
      </section>
    </StorefrontShell>
  );
}
