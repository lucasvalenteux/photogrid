'use client';

import * as React from 'react';
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
  Label,
  Switch,
} from '@photogrid/ui';

import { formatCount, isTestStudio } from '@/lib/admin/format';
import type { StudioAdminDetail } from '@/lib/admin/metrics';
import {
  deleteStudioCascade,
  updateAdminStudio,
} from '@/lib/admin/studio-admin-service';
import { formatCents } from '@/lib/format/currency';
import type { StudioDoc } from '@/types';

export function EditStudioDialog({
  studio,
  open,
  onOpenChange,
}: {
  studio: StudioDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState('');
  const [isTest, setIsTest] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!studio) return;
    setName(studio.name);
    setIsTest(isTestStudio(studio));
  }, [studio]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studio || saving) return;

    setSaving(true);
    try {
      await updateAdminStudio({
        studioId: studio.id,
        name,
        isTest,
      });
      toast.success('Estúdio atualizado.');
      onOpenChange(false);
    } catch (error) {
      console.error('[admin] update studio error', error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível atualizar o estúdio.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar estúdio</DialogTitle>
          <DialogDescription>
            Ajuste o nome administrativo e marque contas usadas apenas para teste.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="admin-studio-name">Nome do estúdio</Label>
            <Input
              id="admin-studio-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              required
              minLength={2}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <Label className="text-sm">Estúdio de teste</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Remove das métricas agregadas do resumo.
              </p>
            </div>
            <Switch
              checked={isTest}
              onCheckedChange={setIsTest}
              disabled={saving}
              label="Marcar como estúdio de teste"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteStudioDialog({
  row,
  open,
  onOpenChange,
}: {
  row: StudioAdminDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) setConfirmation('');
  }, [open]);

  if (!row) return null;

  const expected = row.studio.slug;
  const canDelete = confirmation.trim() === expected;

  const onDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteStudioCascade({
        studioId: row.studio.id,
        slug: row.studio.slug,
        ownerId: row.studio.ownerId,
        logoStoragePath: row.studio.logoStoragePath,
      });
      toast.success('Estúdio excluído.');
      onOpenChange(false);
    } catch (error) {
      console.error('[admin] delete studio error', error);
      toast.error('Não foi possível excluir o estúdio.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir estúdio permanentemente</DialogTitle>
          <DialogDescription>
            Apaga estúdio, galerias, álbuns, fotos, pedidos, clientes e slug.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{row.studio.name}</p>
          <p className="mt-1">
            {formatCount(row.galleries)} galerias · {formatCount(row.albums)} álbuns ·{' '}
            {formatCount(row.photos)} fotos · {formatCents(row.revenueCents)} pagos
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delete-studio-confirm">
            Digite <span className="font-mono">{expected}</span> para confirmar
          </Label>
          <Input
            id="delete-studio-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={deleting}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={deleting}
            disabled={!canDelete || deleting}
            onClick={onDelete}
          >
            Excluir tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
