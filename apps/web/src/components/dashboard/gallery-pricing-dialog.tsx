'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { formatCents, parseBrlInput } from '@/lib/format/currency';
import { updateGalleryPricing } from '@/lib/services/gallery-service';
import type { GalleryDoc, StudioDoc } from '@/types';
import { resolveGalleryPrices } from '@/types';

interface GalleryPricingDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  gallery: GalleryDoc;
  studio: StudioDoc | null;
  onSaved?: () => void;
}

/**
 * Per-gallery price overrides. Two fields — photo and album — that
 * each default to the studio-level pricing (`StudioDoc.pricing`) when
 * left blank. We deliberately allow `0` (a free gallery without
 * touching the studio defaults) and only treat an empty string as
 * "fall back to default".
 *
 * Inputs use `inputMode="decimal"` instead of `type="number"` so
 * Brazilian comma decimals don't get rejected by the browser. The
 * parser at submit time handles both "12,50" and "12.50".
 */
export function GalleryPricingDialog({
  open,
  onOpenChange,
  gallery,
  studio,
  onSaved,
}: GalleryPricingDialogProps) {
  const defaults = resolveGalleryPrices(null, studio);
  const galleryPricing = gallery.pricing ?? {};

  const [photoInput, setPhotoInput] = React.useState(() =>
    formatInitial(galleryPricing.pricePerPhotoCents),
  );
  const [albumInput, setAlbumInput] = React.useState(() =>
    formatInitial(galleryPricing.pricePerAlbumCents),
  );
  const [saving, setSaving] = React.useState(false);

  // Reset whenever the dialog is reopened with new gallery data.
  React.useEffect(() => {
    if (!open) return;
    setPhotoInput(formatInitial(gallery.pricing?.pricePerPhotoCents));
    setAlbumInput(formatInitial(gallery.pricing?.pricePerAlbumCents));
  }, [open, gallery.pricing?.pricePerPhotoCents, gallery.pricing?.pricePerAlbumCents]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const photoCents = parseOverride(photoInput);
    const albumCents = parseOverride(albumInput);
    if (photoCents === 'invalid' || albumCents === 'invalid') {
      toast.error('Use um valor válido em reais (ex.: 19,90).');
      return;
    }

    setSaving(true);
    try {
      await updateGalleryPricing(gallery.id, {
        pricePerPhotoCents: photoCents,
        pricePerAlbumCents: albumCents,
      });
      toast.success('Valores atualizados.');
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('[gallery-pricing] save error', error);
      toast.error('Não foi possível salvar os valores.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valores desta galeria</DialogTitle>
          <DialogDescription>
            Definidos aqui prevalecem sobre os valores padrão do estúdio.
            Deixe em branco para usar o padrão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <PriceField
            id="price-photo"
            label="Foto avulsa"
            placeholder={fallbackPlaceholder(defaults.pricePerPhotoCents)}
            hint={`Padrão do estúdio: ${formatCents(defaults.pricePerPhotoCents)}`}
            value={photoInput}
            onChange={setPhotoInput}
            disabled={saving}
          />
          <PriceField
            id="price-album"
            label="Álbum completo"
            placeholder={fallbackPlaceholder(defaults.pricePerAlbumCents)}
            hint={`Padrão do estúdio: ${formatCents(defaults.pricePerAlbumCents)}`}
            value={albumInput}
            onChange={setAlbumInput}
            disabled={saving}
          />

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PriceFieldProps {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}

function PriceField({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
  disabled,
}: PriceFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function formatInitial(cents: number | null | undefined): string {
  if (typeof cents !== 'number') return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function fallbackPlaceholder(defaultCents: number): string {
  if (!defaultCents) return '0,00';
  return (defaultCents / 100).toFixed(2).replace('.', ',');
}

type OverrideResult = number | null | 'invalid';

function parseOverride(input: string): OverrideResult {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cents = parseBrlInput(trimmed);
  if (cents === null) return 'invalid';
  return cents;
}
