'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { ALBUM_VISIBILITY_LEVELS, effectiveVisibility, type Visibility } from '@photogrid/config';
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
import { updateAlbum } from '@/lib/services/album-service';
import type { AlbumDoc } from '@/types';

interface EditAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  album: AlbumDoc;
  onSaved?: () => void;
}

export function EditAlbumDialog({
  open,
  onOpenChange,
  album,
  onSaved,
}: EditAlbumDialogProps) {
  const [clientName, setClientName] = React.useState(album.title);
  const [visibility, setVisibility] = React.useState<Visibility>(
    effectiveVisibility(album.visibility),
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setClientName(album.title);
    setVisibility(effectiveVisibility(album.visibility));
  }, [album, open]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmed = clientName.trim();
    if (!trimmed) {
      toast.error('Informe o nome do cliente.');
      return;
    }

    setSubmitting(true);
    try {
      await updateAlbum(album.id, { title: trimmed, visibility });
      toast.success('Álbum atualizado.');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar álbum.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar álbum</DialogTitle>
          <DialogDescription>Atualize o nome do cliente deste álbum.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="edit-album-client">Nome do cliente</Label>
            <Input
              id="edit-album-client"
              autoFocus
              required
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              disabled={submitting}
            />
          </div>

          <VisibilitySelector
            value={visibility}
            onChange={setVisibility}
            disabled={submitting}
            label="Quem pode ver?"
            levels={ALBUM_VISIBILITY_LEVELS}
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
