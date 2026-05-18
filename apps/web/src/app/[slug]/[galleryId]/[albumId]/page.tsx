import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPhotosByIds,
  fetchPublicAlbum,
  fetchPublicGalleryWithAccess,
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
  const security = effectiveStudioSecurity(studio);
  return {
    title: `${album.title} · ${studio.name}`,
    other: security.antiAi ? { robots: 'noai, noimageai' } : {},
  };
}

export default async function PublicAlbumPage({ params }: Props) {
  const { slug, galleryId, albumId } = await params;
  // We use the access-aware fetch here too — a public album inside a
  // private gallery is still reachable, and we need the gallery doc to
  // render the breadcrumb back to the gallery page.
  const [studio, access, album] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGalleryWithAccess(galleryId),
    fetchPublicAlbum(albumId),
  ]);
  if (
    !studio ||
    !access ||
    !album ||
    access.gallery.studioId !== studio.id ||
    album.galleryId !== access.gallery.id
  ) {
    notFound();
  }
  const gallery = access.gallery;

  const photos = await fetchPhotosByIds(album.photoIds);
  const security = effectiveStudioSecurity(studio);
  const studioUrl = `${APP_DOMAIN}/${studio.slug}`;

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
                  studioUrl={studioUrl}
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
