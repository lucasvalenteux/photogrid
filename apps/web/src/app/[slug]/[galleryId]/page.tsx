import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';

import { StorefrontAlbumCard } from '@/components/public/storefront-album-card';
import { StorefrontPhotoGrid } from '@/components/public/storefront-photo-grid';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPublicAlbums,
  fetchPublicGalleryPhotos,
  fetchPublicGalleryWithAccess,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';
import {
  effectiveStudioSecurity,
  resolveGalleryPrices,
  securityForStorefrontCovers,
} from '@/types';

interface Props {
  params: Promise<{ slug: string; galleryId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, galleryId } = await params;
  const [studio, access] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGalleryWithAccess(galleryId),
  ]);
  if (!studio || !access || access.gallery.studioId !== studio.id) {
    return { title: 'Galeria não encontrada' };
  }
  const security = effectiveStudioSecurity(studio);
  return {
    title: `${access.gallery.title} · ${studio.name}`,
    description: access.gallery.description ?? undefined,
    other: security.antiAi ? { robots: 'noai, noimageai' } : {},
  };
}

export default async function PublicGalleryPage({ params }: Props) {
  const { slug, galleryId } = await params;
  const [studio, access] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchPublicGalleryWithAccess(galleryId),
  ]);
  if (!studio || !access || access.gallery.studioId !== studio.id) notFound();

  const { gallery, access: accessMode } = access;

  // For `albums-only` (private gallery exposed via public albums) we
  // deliberately skip the photos query — the gallery's own photos were
  // never published. Fetch them only when the gallery itself is public
  // or unlisted, i.e. when the visitor is allowed to see them.
  const [albums, photos] = await Promise.all([
    fetchPublicAlbums(gallery.id),
    accessMode === 'full'
      ? fetchPublicGalleryPhotos(gallery.id)
      : Promise.resolve([]),
  ]);
  const security = effectiveStudioSecurity(studio);
  const coverSecurity = securityForStorefrontCovers(security);
  const studioUrl = `${APP_DOMAIN}/${studio.slug}`;
  const prices = resolveGalleryPrices(gallery, studio);

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

        {accessMode === 'full' ? (
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
              <StorefrontPhotoGrid
                photos={photos}
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
            )}
          </section>
        ) : null}

        {albums.length > 0 ? (
          <section
            className={accessMode === 'full' ? 'mt-12 space-y-4' : 'mt-10 space-y-4'}
          >
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
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  );
}
