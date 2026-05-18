'use client';

import Link from 'next/link';
import * as React from 'react';
import { ArrowLeft, Camera, Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { APP_NAME, ROUTES } from '@photogrid/config';
import { Badge, Button, Logo } from '@photogrid/ui';

import { formatCents } from '@/lib/format/currency';
import type { OrderDoc, PhotoDoc } from '@/types';

interface OrderDownloadClientProps {
  order: OrderDoc;
  studio: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  /** Full photos that the customer paid for (deduplicated across items). */
  photos: PhotoDoc[];
}

/**
 * Token-based download page. Renders the order header + a grid with
 * every photo the customer is entitled to and a single
 * "Baixar todos" CTA that triggers each Storage download in sequence.
 *
 * We deliberately avoid client-side ZIPping for now — Photogrid
 * galleries can hit hundreds of photos and JSZip would blow the
 * browser tab's memory budget. Sequential downloads are well-handled
 * by every modern browser and keep the implementation dependency-free.
 */
export function OrderDownloadClient({
  order,
  studio,
  photos,
}: OrderDownloadClientProps) {
  const [downloading, setDownloading] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  const downloadAll = async () => {
    if (downloading || photos.length === 0) return;
    setDownloading(true);
    setProgress({ done: 0, total: photos.length });
    try {
      for (let i = 0; i < photos.length; i += 1) {
        const photo = photos[i];
        if (!photo) continue;
        await downloadOne(photo);
        setProgress({ done: i + 1, total: photos.length });
        // Small breathing room so browsers don't queue the popups
        // as a single "do you want to allow multiple downloads?".
        await delay(150);
      }
      toast.success('Downloads concluídos.');
    } catch (error) {
      console.error('[downloads] failed', error);
      toast.error('Algum download falhou. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container-app flex h-16 items-center justify-between">
          <Link
            href={ROUTES.studio(studio.slug)}
            className="flex items-center gap-3"
          >
            {studio.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={studio.logoUrl}
                alt={studio.name}
                className="size-9 rounded-lg object-cover"
              />
            ) : (
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-ink text-white">
                <Camera className="size-4" />
              </span>
            )}
            <div className="text-sm">
              <p className="font-semibold leading-tight text-ink">{studio.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {studio.slug}
              </p>
            </div>
          </Link>
          <Link
            href={ROUTES.home}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Logo withWordmark={false} size={18} />
          </Link>
        </div>
      </header>

      <main className="container-app flex-1 py-10 sm:py-14">
        <Link
          href={ROUTES.myPurchases}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Minhas compras
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {order.galleryTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {photos.length} {photos.length === 1 ? 'arquivo' : 'arquivos'} em
              alta resolução · {formatCents(order.totalCents)}
            </p>
          </div>
          <Badge variant="success">Pago</Badge>
        </header>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Baixe todos os arquivos
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {downloading
                ? `Baixando ${progress.done} de ${progress.total}…`
                : 'Iniciamos os downloads em sequência. Não feche a aba até concluir.'}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={downloadAll}
            loading={downloading}
            disabled={photos.length === 0}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {downloading
              ? `${progress.done} / ${progress.total}`
              : `Baixar ${photos.length} arquivos`}
          </Button>
        </div>

        <section className="mt-8">
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Não conseguimos resolver os arquivos deste pedido. Entre em
              contato com o estúdio.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="container-app py-6 text-center text-xs text-muted-foreground">
          Feito com{' '}
          <Link href={ROUTES.home} className="font-medium hover:underline">
            {APP_NAME}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function PhotoTile({ photo }: { photo: PhotoDoc }) {
  const [done, setDone] = React.useState(false);
  const onClick = async () => {
    try {
      await downloadOne(photo);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch (error) {
      console.error('[download] failed', error);
      toast.error('Falha no download.');
    }
  };
  return (
    <figure className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt={photo.fileName}
        loading="lazy"
        className="size-full object-cover"
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={`Baixar ${photo.fileName}`}
        className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/55 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm">
          {done ? <Check className="size-4" /> : <Download className="size-4" />}
        </span>
      </button>
    </figure>
  );
}

async function downloadOne(photo: PhotoDoc): Promise<void> {
  // We fetch the binary so we can preserve the original filename via
  // `download` — directly using <a download> with a Storage URL keeps
  // the auto-generated id name. The Firebase download URL is CORS-
  // open so this `fetch` works without extra config.
  const response = await fetch(photo.imageUrl);
  if (!response.ok) throw new Error('download_failed');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = photo.fileName || `${photo.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
