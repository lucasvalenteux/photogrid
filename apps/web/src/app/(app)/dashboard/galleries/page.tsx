'use client';

import * as React from 'react';
import { Images, Plus } from 'lucide-react';

import { effectiveVisibility, ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

import { CoverCard } from '@/components/dashboard/cover-card';
import { CreateGalleryDialog } from '@/components/dashboard/create-gallery-dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import { VisibilityBadge } from '@/components/dashboard/visibility-selector';
import { useAuth } from '@/lib/hooks/use-auth';
import { subscribeToGalleries } from '@/lib/services/gallery-service';
import type { GalleryDoc } from '@/types';

function pluraliseCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function GalleriesPage() {
  const { studio } = useAuth();
  const [galleries, setGalleries] = React.useState<GalleryDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!studio) return;
    setLoading(true);
    const unsubscribe = subscribeToGalleries(
      studio.id,
      (next) => {
        setGalleries(next);
        setLoading(false);
      },
      (error) => {
        console.error('[galleries] subscription error', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [studio]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Galerias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada galeria reúne as fotos de um cliente, escola ou evento.
          </p>
        </div>
        {galleries.length > 0 ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nova galeria
          </Button>
        ) : null}
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : galleries.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Nenhuma galeria por aqui ainda."
          description="Crie sua primeira galeria para começar a subir fotos e montar álbuns para os clientes."
          actionLabel="Criar galeria"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((gallery) => {
            const visibility = effectiveVisibility(gallery.visibility);
            return (
              <CoverCard
                key={gallery.id}
                href={ROUTES.gallery(gallery.id)}
                title={gallery.title}
                subtitle={gallery.description ?? undefined}
                coverUrl={gallery.coverPhotoUrl ?? null}
                meta={[
                  pluraliseCount(gallery.photoCount, 'foto', 'fotos'),
                  pluraliseCount(gallery.albumCount, 'álbum', 'álbuns'),
                ].join(' · ')}
                topRight={
                  visibility !== 'public' ? (
                    <VisibilityBadge visibility={visibility} />
                  ) : null
                }
              />
            );
          })}
        </div>
      )}

      <CreateGalleryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
