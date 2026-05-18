'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { effectiveVisibility, type Visibility } from '@photogrid/config';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { VisibilitySelector } from '@/components/dashboard/visibility-selector';
import { updateGallery } from '@/lib/services/gallery-service';
import type { GalleryDoc } from '@/types';

interface EditGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: GalleryDoc;
  onSaved?: () => void;
}

export function EditGalleryDialog({
  open,
  onOpenChange,
  gallery,
  onSaved,
}: EditGalleryDialogProps) {
  const [title, setTitle] = React.useState(gallery.title);
  const [description, setDescription] = React.useState(gallery.description ?? '');
  const [visibility, setVisibility] = React.useState<Visibility>(
    effectiveVisibility(gallery.visibility),
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(gallery.title);
    setDescription(gallery.description ?? '');
    setVisibility(effectiveVisibility(gallery.visibility));
  }, [gallery, open]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error('Dê um título à galeria.');
      return;
    }

    setSubmitting(true);
    try {
      await updateGallery(gallery.id, { title: trimmed, description, visibility });
      toast.success('Galeria atualizada.');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar galeria.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar galeria</DialogTitle>
          <DialogDescription>
            Atualize o título ou a descrição da galeria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="edit-gallery-title">Título</Label>
            <Input
              id="edit-gallery-title"
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-gallery-description">Descrição (opcional)</Label>
            <Input
              id="edit-gallery-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Uma frase curta para você se lembrar"
              disabled={submitting}
            />
          </div>

          <VisibilitySelector
            value={visibility}
            onChange={setVisibility}
            disabled={submitting}
            label="Quem pode ver?"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
