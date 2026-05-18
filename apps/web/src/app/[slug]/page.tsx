import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { APP_NAME, ROUTES } from '@photogrid/config';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPublicGalleries,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';
import { effectiveStudioSecurity } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const studio = await fetchPublicStudioBySlug(slug);
  if (!studio) {
    return { title: 'Estúdio não encontrado' };
  }
  return {
    title: studio.name,
    description: `Galerias de ${studio.name} no ${APP_NAME}.`,
    openGraph: {
      title: studio.name,
      description: `Galerias de ${studio.name}.`,
      url: ROUTES.studio(studio.slug),
    },
  };
}

export default async function PublicStudioPage({ params }: Props) {
  const { slug } = await params;
  const studio = await fetchPublicStudioBySlug(slug);
  if (!studio) notFound();

  const galleries = await fetchPublicGalleries(studio.id);
  const security = effectiveStudioSecurity(studio);

  return (
    <StorefrontShell studio={studio}>
      <section className="container-app py-12 sm:py-16">
        <header className="mb-10 max-w-2xl">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {studio.name}
          </h1>
          <p className="mt-3 text-pretty text-sm text-muted-foreground">
            Escolha uma galeria para ver os álbuns publicados.
          </p>
        </header>

        {galleries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            Nenhuma galeria publicada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((gallery) => (
              <Link
                key={gallery.id}
                href={ROUTES.publicGallery(studio.slug, gallery.id)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {gallery.coverPhotoUrl ? (
                  <ProtectedPhoto
                    src={gallery.coverPhotoUrl}
                    alt={gallery.title}
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
                    {gallery.title}
                  </h2>
                  {gallery.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {gallery.description}
                    </p>
                  ) : null}
                  <p className="pt-2 text-xs text-muted-foreground">
                    {gallery.albumCount}{' '}
                    {gallery.albumCount === 1 ? 'álbum' : 'álbuns'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}
