import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';

import { AddToCartButton } from '@/components/public/add-to-cart-button';
import { StorefrontPhotoGrid } from '@/components/public/storefront-photo-grid';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  canAccessPublicAlbumPage,
  fetchGalleryDoc,
  fetchPhotosByIds,
  fetchPublicAlbum,
  fetchPublicStudioBySlug,
  shouldShowGalleryBreadcrumbOnAlbumPage,
} from '@/lib/services/public-service';
import { effectiveStudioSecurity, resolveGalleryPrices } from '@/types';

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
  const [studio, gallery, album] = await Promise.all([
    fetchPublicStudioBySlug(slug),
    fetchGalleryDoc(galleryId),
    fetchPublicAlbum(albumId),
  ]);
  if (
    !studio ||
    !gallery ||
    !album ||
    gallery.studioId !== studio.id ||
    !canAccessPublicAlbumPage(gallery, album)
  ) {
    notFound();
  }
  const showGalleryBreadcrumb = shouldShowGalleryBreadcrumbOnAlbumPage(gallery);

  const photos = await fetchPhotosByIds(album.photoIds);
  const security = effectiveStudioSecurity(studio);
  const studioUrl = `${APP_DOMAIN}/${studio.slug}`;
  const prices = resolveGalleryPrices(gallery, studio);

  return (
    <StorefrontShell studio={studio}>
      <section className="container-app py-10 sm:py-14">
        {showGalleryBreadcrumb ? (
          <Link
            href={ROUTES.publicGallery(studio.slug, gallery.id)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            {gallery.title}
          </Link>
        ) : (
          <Link
            href={ROUTES.studio(studio.slug)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Voltar para {studio.name}
          </Link>
        )}

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

        {prices.pricePerAlbumCents > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              Compre o álbum completo com todas as fotos em alta
              qualidade.
            </p>
            <AddToCartButton
              size="lg"
              showPrice
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
                  priceCents: prices.pricePerAlbumCents,
                  photoCount: album.photoIds.length,
                },
              }}
            />
          </div>
        ) : null}

        <div className="mt-8">
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              As fotos deste álbum serão publicadas em breve.
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
        </div>
      </section>
    </StorefrontShell>
  );
}
