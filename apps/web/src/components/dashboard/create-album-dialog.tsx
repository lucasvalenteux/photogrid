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
import { createAlbum } from '@/lib/services/album-service';

interface CreateAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galleryId: string;
  onCreated?: (albumId: string) => void;
}

/**
 * Inline dialog used inside a Gallery detail page to start a new client
 * album. Single field: client name. The selection of photos is done from the
 * album detail page after creation.
 */
export function CreateAlbumDialog({
  open,
  onOpenChange,
  galleryId,
  onCreated,
}: CreateAlbumDialogProps) {
  const { studio } = useAuth();
  const [clientName, setClientName] = React.useState('');
  // Albums hold a client's name, so they default to `unlisted` — visible to
  // anyone with the link but not advertised on the studio home.
  const [visibility, setVisibility] = React.useState<Visibility>('unlisted');
  const [submitting, setSubmitting] = React.useState(false);

  const reset = React.useCallback(() => {
    setClientName('');
    setVisibility('unlisted');
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !studio) return;
    const trimmed = clientName.trim();
    if (!trimmed) {
      toast.error('Informe o nome do cliente.');
      return;
    }

    setSubmitting(true);
    try {
      const album = await createAlbum({
        studioId: studio.id,
        galleryId,
        title: trimmed,
        visibility,
      });
      toast.success('Álbum criado.');
      reset();
      onOpenChange(false);
      onCreated?.(album.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar álbum.';
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
          <DialogTitle>Novo álbum</DialogTitle>
          <DialogDescription>
            Cada álbum pertence a um cliente — depois você seleciona quais fotos
            da galeria fazem parte dele.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="album-client">Nome do cliente</Label>
            <Input
              id="album-client"
              autoFocus
              required
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="Ex: Família Silva"
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
              {submitting ? 'Criando…' : 'Criar álbum'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
