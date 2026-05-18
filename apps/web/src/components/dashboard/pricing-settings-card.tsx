'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { formatCents, parseBrlInput } from '@/lib/format/currency';
import { updateStudioPricing } from '@/lib/services/studio-service';
import type { StudioDoc } from '@/types';

interface PricingSettingsCardProps {
  studio: StudioDoc | null;
}

/**
 * Studio-wide "Valores" card on /dashboard/settings. These values back
 * every gallery that hasn't explicitly overridden them
 * (`GalleryDoc.pricing`), so changing one number here cascades through
 * the entire storefront.
 *
 * We persist only the cent integers — see `@/lib/format/currency` for
 * the BRL display/parse helpers — and use a Save button (not an
 * autosave switch) because typing a partial value mid-edit would
 * otherwise broadcast a half-finished price to the public site.
 */
export function PricingSettingsCard({ studio }: PricingSettingsCardProps) {
  const persistedPhoto = studio?.pricing?.pricePerPhotoCents ?? null;
  const persistedAlbum = studio?.pricing?.pricePerAlbumCents ?? null;

  const [photoInput, setPhotoInput] = React.useState(() =>
    formatInitial(persistedPhoto),
  );
  const [albumInput, setAlbumInput] = React.useState(() =>
    formatInitial(persistedAlbum),
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setPhotoInput(formatInitial(persistedPhoto));
    setAlbumInput(formatInitial(persistedAlbum));
  }, [persistedPhoto, persistedAlbum]);

  const photoCents = parseInput(photoInput);
  const albumCents = parseInput(albumInput);
  const isValid = photoCents !== 'invalid' && albumCents !== 'invalid';
  const dirty =
    photoCents !== persistedPhoto || albumCents !== persistedAlbum;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studio || saving || !isValid || !dirty) return;
    setSaving(true);
    try {
      await updateStudioPricing(studio.id, {
        pricePerPhotoCents: photoCents === null ? undefined : photoCents,
        pricePerAlbumCents: albumCents === null ? undefined : albumCents,
      });
      toast.success('Valores padrão atualizados.');
    } catch (error) {
      console.error('[pricing] save error', error);
      toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores</CardTitle>
        <CardDescription>
          Valores padrão usados pelas galerias da loja. Cada galeria pode
          sobrescrever os seus próprios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PriceField
              id="studio-price-photo"
              label="Foto avulsa"
              hint={
                persistedPhoto
                  ? `Atual: ${formatCents(persistedPhoto)}`
                  : 'Sem valor definido — galerias precisam configurar individualmente.'
              }
              value={photoInput}
              onChange={setPhotoInput}
              disabled={!studio || saving}
            />
            <PriceField
              id="studio-price-album"
              label="Álbum completo"
              hint={
                persistedAlbum
                  ? `Atual: ${formatCents(persistedAlbum)}`
                  : 'Sem valor definido — galerias precisam configurar individualmente.'
              }
              value={albumInput}
              onChange={setAlbumInput}
              disabled={!studio || saving}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              loading={saving}
              disabled={!studio || !isValid || !dirty}
            >
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface PriceFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}

function PriceField({ id, label, hint, value, onChange, disabled }: PriceFieldProps) {
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
          placeholder="0,00"
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

function parseInput(input: string): number | null | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cents = parseBrlInput(trimmed);
  if (cents === null) return 'invalid';
  return cents;
}
