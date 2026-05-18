'use client';

import * as React from 'react';
import {
  Calendar,
  FileImage,
  HardDrive,
  ImageIcon,
  Maximize2,
  Ruler,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@photogrid/ui';

import { deletePhoto } from '@/lib/services/photo-service';
import type { PhotoDoc } from '@/types';

interface PhotoGridProps {
  photos: PhotoDoc[];
  canDelete?: boolean;
  onPhotoDeleted?: (photoId: string) => void;
  /**
   * When true, skips the outer grid wrapper and renders the `<figure>`
   * tiles as direct children — useful when the parent owns the grid layout
   * to compose extra cells (e.g. an inline uploader tile as the first item).
   */
  embedded?: boolean;
  className?: string;
}

export function PhotoGrid({
  photos,
  canDelete = false,
  onPhotoDeleted,
  embedded = false,
  className,
}: PhotoGridProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PhotoDoc | null>(null);

  const onDelete = async (photo: PhotoDoc) => {
    if (!canDelete) return;
    if (!window.confirm(`Remover "${photo.fileName}"?`)) return;
    setDeletingId(photo.id);
    try {
      await deletePhoto(photo);
      onPhotoDeleted?.(photo.id);
      toast.success('Foto removida.');
      setSelectedPhoto((current) => (current?.id === photo.id ? null : current));
    } catch (error) {
      console.error(error);
      toast.error('Falha ao remover a foto.');
    } finally {
      setDeletingId(null);
    }
  };

  const tiles = photos.map((photo) => (
    <figure
      key={photo.id}
      className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
    >
      <button
        type="button"
        onClick={() => setSelectedPhoto(photo)}
        className="block h-full w-full text-left"
        aria-label={`Abrir detalhes de ${photo.fileName}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnailUrl ?? photo.imageUrl}
          alt={photo.fileName}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <Maximize2 className="size-3" />
        Detalhes
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void onDelete(photo);
          }}
          disabled={deletingId === photo.id}
          aria-label={`Remover ${photo.fileName}`}
          className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </figure>
  ));

  const dialog = (
    <PhotoDetailsDialog
      photo={selectedPhoto}
      open={Boolean(selectedPhoto)}
      onOpenChange={(open) => {
        if (!open) setSelectedPhoto(null);
      }}
      canDelete={canDelete}
      deleting={Boolean(selectedPhoto && deletingId === selectedPhoto.id)}
      onDelete={onDelete}
    />
  );

  if (embedded) {
    return (
      <>
        {tiles}
        {dialog}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'grid gap-2 sm:gap-3',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
          className,
        )}
      >
        {tiles}
      </div>
      {dialog}
    </>
  );
}

interface PhotoDetailsDialogProps {
  photo: PhotoDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (photo: PhotoDoc) => Promise<void>;
}

function PhotoDetailsDialog({
  photo,
  open,
  onOpenChange,
  canDelete,
  deleting,
  onDelete,
}: PhotoDetailsDialogProps) {
  const quality = React.useMemo(
    () => (photo ? analyzePhotoQuality(photo) : null),
    [photo],
  );

  if (!photo || !quality) return null;

  const dimensions = formatDimensions(photo);
  const megapixels = formatMegapixels(photo);
  const uploadedAt = formatDateTime(photo.createdAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-[360px] items-center justify-center bg-ink p-3 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl}
              alt={photo.fileName}
              className="max-h-[78vh] w-full rounded-lg object-contain"
            />
          </div>

          <aside className="space-y-5 p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="line-clamp-2 break-all text-base">
                {photo.fileName}
              </DialogTitle>
              <DialogDescription>
                Detalhes técnicos, dados do arquivo e qualidade estimada.
              </DialogDescription>
            </DialogHeader>

            <section className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Qualidade analisada
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                    {quality.label}
                  </p>
                </div>
                <Badge variant={quality.badgeVariant}>{quality.score}/100</Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', quality.barClassName)}
                  style={{ width: `${quality.score}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {quality.summary}
              </p>
              {quality.notes.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {quality.notes.map((note) => (
                    <li key={note} className="flex gap-1.5">
                      <Sparkles className="mt-0.5 size-3 shrink-0 text-brand-500" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Dados da foto</h3>
              <div className="grid gap-2">
                <InfoRow
                  icon={Ruler}
                  label="Dimensões"
                  value={dimensions}
                  detail={megapixels}
                />
                <InfoRow
                  icon={HardDrive}
                  label="Peso"
                  value={formatBytes(photo.bytes)}
                  detail={quality.bytesPerMegapixel}
                />
                <InfoRow
                  icon={FileImage}
                  label="Tipo"
                  value={photo.contentType ?? 'Não informado'}
                  detail={fileExtension(photo.fileName)}
                />
                <InfoRow
                  icon={Calendar}
                  label="Enviada em"
                  value={uploadedAt || 'Não informado'}
                />
                <InfoRow
                  icon={ImageIcon}
                  label="ID da foto"
                  value={photo.id}
                  mono
                />
              </div>
            </section>

            <DialogFooter className="gap-2 border-t border-border pt-4">
              {canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  loading={deleting}
                  onClick={() => void onDelete(photo)}
                >
                  <Trash2 className="size-4" />
                  Excluir foto
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  detail,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'mt-0.5 truncate text-sm font-medium text-foreground',
            mono && 'font-mono text-xs',
          )}
          title={value}
        >
          {value}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

interface PhotoQualityAnalysis {
  score: number;
  label: string;
  summary: string;
  notes: string[];
  bytesPerMegapixel: string;
  badgeVariant: 'success' | 'brand' | 'outline' | 'default';
  barClassName: string;
}

function analyzePhotoQuality(photo: PhotoDoc): PhotoQualityAnalysis {
  const megapixels =
    photo.width && photo.height ? (photo.width * photo.height) / 1_000_000 : 0;
  const bytesPerMegapixel =
    photo.bytes && megapixels > 0 ? photo.bytes / megapixels : null;

  let score = 42;
  const notes: string[] = [];

  if (megapixels >= 12) {
    score += 34;
    notes.push('Resolução excelente para impressão grande.');
  } else if (megapixels >= 6) {
    score += 26;
    notes.push('Resolução boa para impressão e entrega digital.');
  } else if (megapixels >= 3) {
    score += 16;
    notes.push('Resolução média; ideal revisar antes de vender em formatos grandes.');
  } else if (megapixels > 0) {
    score += 4;
    notes.push('Resolução baixa para impressão grande.');
  } else {
    notes.push('Dimensões não disponíveis para análise completa.');
  }

  if (bytesPerMegapixel !== null) {
    if (bytesPerMegapixel >= 450_000) {
      score += 16;
      notes.push('Arquivo com boa densidade de dados por megapixel.');
    } else if (bytesPerMegapixel >= 180_000) {
      score += 9;
      notes.push('Compressão dentro do esperado para web/entrega digital.');
    } else {
      score -= 8;
      notes.push('Arquivo parece bem comprimido; confira nitidez e artefatos.');
    }
  } else {
    notes.push('Peso do arquivo não informado.');
  }

  if (photo.width && photo.height) {
    const longEdge = Math.max(photo.width, photo.height);
    const shortEdge = Math.min(photo.width, photo.height);
    if (shortEdge < 1600) {
      score -= 10;
      notes.push('Lado menor abaixo de 1600px pode limitar impressões.');
    }
    if (longEdge >= 4000) {
      score += 6;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 82) {
    return {
      score,
      label: 'Alta',
      summary:
        'A análise automática indica boa resolução e arquivo consistente para venda.',
      notes,
      bytesPerMegapixel: formatBytesPerMegapixel(bytesPerMegapixel),
      badgeVariant: 'success',
      barClassName: 'bg-emerald-500',
    };
  }

  if (score >= 62) {
    return {
      score,
      label: 'Boa',
      summary:
        'A foto parece adequada para entrega digital e impressões comuns.',
      notes,
      bytesPerMegapixel: formatBytesPerMegapixel(bytesPerMegapixel),
      badgeVariant: 'brand',
      barClassName: 'bg-brand-500',
    };
  }

  if (score >= 42) {
    return {
      score,
      label: 'Atenção',
      summary:
        'A foto pode funcionar, mas vale revisar resolução, foco e compressão.',
      notes,
      bytesPerMegapixel: formatBytesPerMegapixel(bytesPerMegapixel),
      badgeVariant: 'outline',
      barClassName: 'bg-amber-500',
    };
  }

  return {
    score,
    label: 'Baixa',
    summary:
      'A foto tem poucos dados técnicos para venda em alta qualidade. Revise antes de liberar.',
    notes,
    bytesPerMegapixel: formatBytesPerMegapixel(bytesPerMegapixel),
    badgeVariant: 'default',
    barClassName: 'bg-muted-foreground',
  };
}

function formatDimensions(photo: PhotoDoc): string {
  if (!photo.width || !photo.height) return 'Não informado';
  return `${photo.width} × ${photo.height}px`;
}

function formatMegapixels(photo: PhotoDoc): string {
  if (!photo.width || !photo.height) return 'Megapixels não informados';
  const mp = (photo.width * photo.height) / 1_000_000;
  return `${mp.toFixed(mp >= 10 ? 1 : 2)} MP`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Não informado';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatBytesPerMegapixel(value: number | null): string {
  if (value === null) return 'Densidade não informada';
  return `${formatBytes(Math.round(value))}/MP`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fileExtension(fileName: string): string {
  const extension = fileName.split('.').pop();
  return extension ? `.${extension.toLowerCase()}` : 'Extensão não informada';
}
