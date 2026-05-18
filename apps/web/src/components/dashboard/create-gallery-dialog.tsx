'use client';

import * as React from 'react';
import { toast } from 'sonner';

import type { Visibility } from '@photogrid/config';
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
import { useAuth } from '@/lib/hooks/use-auth';
import { createGallery } from '@/lib/services/gallery-service';

interface CreateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (galleryId: string) => void;
}

export function CreateGalleryDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateGalleryDialogProps) {
  const { studio } = useAuth();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState<Visibility>('public');
  const [submitting, setSubmitting] = React.useState(false);

  const reset = React.useCallback(() => {
    setTitle('');
    setDescription('');
    setVisibility('public');
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !studio) return;
    if (title.trim().length < 1) {
      toast.error('Dê um título à galeria.');
      return;
    }

    setSubmitting(true);
    try {
      const gallery = await createGallery({
        studioId: studio.id,
        title,
        description: description.trim() || undefined,
        visibility,
      });
      toast.success('Galeria criada.');
      reset();
      onOpenChange(false);
      onCreated?.(gallery.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar galeria.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova galeria</DialogTitle>
          <DialogDescription>
            Uma galeria reúne todas as fotos de um cliente, escola ou evento. Depois
            você monta álbuns selecionando as fotos para cada destinatário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="gallery-title">Título</Label>
            <Input
              id="gallery-title"
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Colégio Santa Maria — 2026"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gallery-description">Descrição (opcional)</Label>
            <Input
              id="gallery-description"
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
              {submitting ? 'Criando…' : 'Criar galeria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
