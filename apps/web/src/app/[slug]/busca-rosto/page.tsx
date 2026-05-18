import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';

import { PublicFaceSearchResults } from '@/components/public/public-face-search-results';
import { StorefrontShell } from '@/components/public/storefront-shell';
import {
  fetchPublicFaceSearchIndex,
  fetchPublicStudioBySlug,
} from '@/lib/services/public-service';
import {
  effectivePublicFaceSearchEnabled,
  effectiveStudioSecurity,
} from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const studio = await fetchPublicStudioBySlug(slug);
  if (!studio) {
    return { title: 'Busca não encontrada' };
  }

  const security = effectiveStudioSecurity(studio);
  return {
    title: `Resultados da busca · ${studio.name}`,
    description: `Fotos encontradas pela busca facial de ${studio.name}.`,
    other: security.antiAi ? { robots: 'noai, noimageai' } : {},
  };
}

export default async function PublicFaceSearchResultsPage({ params }: Props) {
  const { slug } = await params;
  const studio = await fetchPublicStudioBySlug(slug);
  if (!studio || !effectivePublicFaceSearchEnabled(studio)) notFound();

  const [faceSearchIndex] = await Promise.all([
    fetchPublicFaceSearchIndex(studio.id),
  ]);
  const security = effectiveStudioSecurity(studio);
  const studioUrl = `${APP_DOMAIN}/${studio.slug}`;

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
            Resultados da busca
          </h1>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            Álbuns com fotos compatíveis aparecem primeiro. Abaixo ficam todas
            as fotos encontradas, com as mesmas opções de compra da loja.
          </p>
        </header>

        <div className="mt-10">
          <PublicFaceSearchResults
            studio={studio}
            studioUrl={studioUrl}
            security={security}
            photos={faceSearchIndex.photos}
            albums={faceSearchIndex.albums}
            galleries={faceSearchIndex.galleries}
          />
        </div>
      </section>
    </StorefrontShell>
  );
}
