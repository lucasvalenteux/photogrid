'use client';

import * as React from 'react';
import { Check, ImageOff, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@photogrid/ui';

import { setAlbumPhotos } from '@/lib/services/album-service';
import type { PhotoDoc } from '@/types';

interface PhotoSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string;
  /** All photos available in the parent gallery — pre-fetched by the caller. */
  galleryPhotos: PhotoDoc[];
  /** Photos already in the album, used to pre-check the grid. */
  initialSelectedIds: string[];
  onSaved?: () => void;
}

/**
 * Multi-select dialog: the photographer picks which gallery photos belong to
 * an album. The dialog never mutates anything until the user clicks "Salvar"
 * — escapes and "Cancelar" discard local changes.
 *
 * UX details:
 *   - Top-level search by filename.
 *   - Sticky footer shows the running selection count.
 *   - Tap anywhere on the thumbnail to toggle.
 *   - Selected photos render with a brand-tinted overlay + check badge.
 */
export function PhotoSelectorDialog({
  open,
  onOpenChange,
  albumId,
  galleryPhotos,
  initialSelectedIds,
  onSaved,
}: PhotoSelectorDialogProps) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );
  const [filter, setFilter] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Re-sync when re-opened on a different album, or when the album's stored
  // selection changes on the server.
  React.useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialSelectedIds));
    setFilter('');
  }, [open, initialSelectedIds]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return galleryPhotos;
    return galleryPhotos.filter((photo) =>
      photo.fileName.toLowerCase().includes(needle),
    );
  }, [filter, galleryPhotos]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAllFiltered = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const onSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Preserve the user's intended ordering: photos appear in the album in
      // the same order they exist in the gallery (oldest-first).
      const ids = galleryPhotos.filter((p) => selected.has(p.id)).map((p) => p.id);
      await setAlbumPhotos({
        albumId,
        photoIds: ids,
        galleryPhotos,
      });
      toast.success(
        ids.length === 0
          ? 'Seleção limpa.'
          : `${ids.length} ${ids.length === 1 ? 'foto adicionada' : 'fotos adicionadas'} ao álbum.`,
      );
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('[photo-selector] save failed', error);
      toast.error('Falha ao salvar a seleção.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar fotos</DialogTitle>
          <DialogDescription>
            Escolha quais fotos desta galeria fazem parte do álbum. A seleção é
            mantida e pode ser editada quando quiser.
          </DialogDescription>
        </DialogHeader>

        {galleryPhotos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            <ImageOff className="size-5" />
            Nenhuma foto na galeria ainda. Suba fotos na galeria antes de montar o
            álbum.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Buscar pelo nome do arquivo"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAllFiltered}
                disabled={filtered.length === 0}
              >
                {allFilteredSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
              </Button>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-muted/40 p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-12 text-center text-sm text-muted-foreground">
                  Nenhuma foto bate com a busca.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {filtered.map((photo) => {
                    const isSelected = selected.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => toggle(photo.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'group relative aspect-square overflow-hidden rounded-lg border-2 bg-card transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'border-brand-500 ring-2 ring-brand-500/30'
                            : 'border-transparent hover:border-border',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumbnailUrl ?? photo.imageUrl}
                          alt={photo.fileName}
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            'h-full w-full object-cover transition-transform duration-200',
                            isSelected ? 'scale-[0.96]' : 'group-hover:scale-[1.02]',
                          )}
                        />
                        {isSelected ? (
                          <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm ring-2 ring-white">
                            <Check className="size-3.5" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selected.size === 0
              ? 'Nenhuma foto selecionada'
              : `${selected.size} ${selected.size === 1 ? 'foto selecionada' : 'fotos selecionadas'}`}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onSave}
              loading={submitting}
              disabled={galleryPhotos.length === 0}
            >
              {submitting ? 'Salvando…' : 'Salvar seleção'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
