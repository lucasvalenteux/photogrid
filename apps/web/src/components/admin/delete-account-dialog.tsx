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

import { isSystemAdmin } from '@/lib/admin/access';
import type { AccountAdminDetail } from '@/lib/admin/metrics';
import {
  accountDeleteConfirmationValue,
  deleteAdminAccount,
} from '@/lib/admin/user-admin-service';

interface DeleteAccountDialogProps {
  account: AccountAdminDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [confirmation, setConfirmation] = React.useState('');
  const [deleteOwnedStudio, setDeleteOwnedStudio] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const ownsStudio = Boolean(
    account?.studio && account.studio.ownerId === account.user.id,
  );

  React.useEffect(() => {
    if (!open) return;
    setConfirmation('');
    setDeleteOwnedStudio(ownsStudio);
  }, [open, ownsStudio, account?.user.id]);

  if (!account) return null;

  const expected = accountDeleteConfirmationValue(account);
  const canDelete =
    confirmation.trim().toLowerCase() === expected.toLowerCase() &&
    (!ownsStudio || deleteOwnedStudio);
  const blocked = isSystemAdmin(account.displayEmail) || isSystemAdmin(account.user.email);

  const onDelete = async () => {
    if (!canDelete || deleting || blocked) return;
    setDeleting(true);
    try {
      await deleteAdminAccount(account, { deleteOwnedStudio });
      toast.success('Conta removida do Photogrid.');
      onOpenChange(false);
    } catch (error) {
      console.error('[admin] delete account error', error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir a conta.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir conta</DialogTitle>
          <DialogDescription>
            Remove o perfil em Firestore e os logs de acesso. O login no Firebase
            Auth pode continuar existindo até você revogar no console Firebase.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Contas de administrador do sistema não podem ser excluídas por aqui.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">{account.displayEmail}</p>
              <p className="mt-1 font-mono text-xs">UID {account.user.id}</p>
              {account.studio ? (
                <p className="mt-1">
                  Estúdio: {account.studio.name} (/{account.studio.slug})
                </p>
              ) : null}
            </div>

            {ownsStudio && account.studio ? (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <Label className="text-sm">Excluir estúdio e todo o conteúdo</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Galerias, fotos, pedidos e slug público de{' '}
                    <span className="font-medium">{account.studio.name}</span> serão
                    apagados.
                  </p>
                </div>
                <Switch
                  checked={deleteOwnedStudio}
                  onCheckedChange={setDeleteOwnedStudio}
                  disabled={deleting}
                  label="Excluir estúdio vinculado"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="delete-account-confirm">
                Digite{' '}
                <span className="font-mono text-foreground">{expected}</span> para confirmar
              </Label>
              <Input
                id="delete-account-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={deleting}
                autoComplete="off"
              />
            </div>
          </>
        )}

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
            disabled={blocked || !canDelete || deleting}
            onClick={onDelete}
          >
            Excluir conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
