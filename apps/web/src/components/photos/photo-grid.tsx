'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@photogrid/ui';

import { deletePhoto } from '@/lib/services/photo-service';
import type { PhotoDoc } from '@/types';

interface PhotoGridProps {
  photos: PhotoDoc[];
  canDelete?: boolean;
  /**
   * When true, skips the outer grid wrapper and renders the `<figure>`
   * tiles as direct children — useful when the parent owns the grid layout
   * to compose extra cells (e.g. an inline uploader tile as the first item).
   */
  embedded?: boolean;
  className?: string;
}

export function PhotoGrid({
  photos,
  canDelete = false,
  embedded = false,
  className,
}: PhotoGridProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const onDelete = async (photo: PhotoDoc) => {
    if (!canDelete) return;
    if (!window.confirm(`Remover "${photo.fileName}"?`)) return;
    setDeletingId(photo.id);
    try {
      await deletePhoto(photo);
      toast.success('Foto removida.');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao remover a foto.');
    } finally {
      setDeletingId(null);
    }
  };

  const tiles = photos.map((photo) => (
    <figure
      key={photo.id}
      className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt={photo.fileName}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(photo)}
          disabled={deletingId === photo.id}
          aria-label={`Remover ${photo.fileName}`}
          className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </figure>
  ));

  if (embedded) return <>{tiles}</>;

  return (
    <div
      className={cn(
        'grid gap-2 sm:gap-3',
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {tiles}
    </div>
  );
}
