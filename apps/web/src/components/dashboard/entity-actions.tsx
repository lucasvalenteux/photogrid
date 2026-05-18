'use client';

import * as React from 'react';
import { Check, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@photogrid/ui';

interface EntityActionsProps {
  /** Public URL to share — copied to the clipboard on click. */
  shareUrl: string;
  /** Optional label used in copy/toast feedback ("Link do álbum copiado"). */
  shareLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * Disable the destructive item with an explanatory tooltip — useful when
   * the entity still has children that would be orphaned.
   */
  deleteDisabled?: { reason: string } | false;
}

/**
 * Pair of action controls used at the top of an album / session detail page:
 *
 *   [share]  [⋯ menu]
 *
 * The share button is a single click — copies the canonical public URL to the
 * clipboard. The menu hosts edit + delete to keep the surface uncluttered.
 *
 * Both controls degrade gracefully when their callbacks aren't provided.
 */
export function EntityActions({
  shareUrl,
  shareLabel = 'Link',
  onEdit,
  onDelete,
  deleteDisabled = false,
}: EntityActionsProps) {
  const [justCopied, setJustCopied] = React.useState(false);

  const onShare = async () => {
    try {
      // Modern clipboard API. We don't rely on `navigator.share` here because
      // we always want the URL on the clipboard regardless of the platform.
      await navigator.clipboard.writeText(shareUrl);
      setJustCopied(true);
      toast.success(`${shareLabel} copiado para a área de transferência.`);
      window.setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error('[share] clipboard write failed', error);
      toast.error('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onShare}
            aria-label={`Copiar ${shareLabel.toLowerCase()}`}
          >
            {justCopied ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Link2 className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copiar link público</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Mais ações"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Mais ações</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          {onEdit ? (
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
          ) : null}
          {onEdit && onDelete ? <DropdownMenuSeparator /> : null}
          {onDelete ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={Boolean(deleteDisabled)}
              onSelect={(event) => {
                if (deleteDisabled) {
                  event.preventDefault();
                  toast.info(deleteDisabled.reason);
                  return;
                }
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
              Excluir
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
