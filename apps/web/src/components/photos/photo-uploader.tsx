'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button, cn } from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import { enqueuePhotoForClustering } from '@/lib/services/face-clustering-service';
import { uploadAndCommitPhoto } from '@/lib/services/photo-service';

/* ------------------------------------------------------------------------- */
/* Constants & types                                                          */
/* ------------------------------------------------------------------------- */

const MAX_FILE_BYTES = 25 * 1024 * 1024; // mirror storage.rules
const MAX_PARALLEL_UPLOADS = 3;

type Status = 'queued' | 'uploading' | 'done' | 'error';

export interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
}

export interface UsePhotoUploaderOptions {
  galleryId: string;
  onUploaded?: (count: number) => void;
}

export interface PhotoUploaderApi {
  queue: QueuedFile[];
  enqueueFiles: (files: FileList | File[]) => void;
  /** Remove finished + errored items from the visible queue. */
  dismissSettled: () => void;
  /** Drop everything regardless of status. */
  reset: () => void;
  /** True while at least one file is queued or uploading. */
  active: boolean;
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/* ------------------------------------------------------------------------- */
/* usePhotoUploader hook                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Headless uploader hook. Owns the upload queue + worker pool, exposes a
 * simple API so the visual pieces (drop tile, progress panel) can be placed
 * anywhere in the layout.
 *
 * Concurrency model:
 *   - A synchronous claim set (`inFlightRef`) is used by the worker pool to
 *     atomically reserve queued files before they're awaited. This prevents
 *     a class of races where multiple workers picked the same file because
 *     `setState`-based claims only become visible across workers on the
 *     next React render.
 *   - A single-flight guard (`processingRef`) ensures `processQueue` runs
 *     at most once; concurrent calls fall through and the in-flight workers
 *     pick up newly enqueued files via `claimNext` on their next loop.
 */
export function usePhotoUploader({
  galleryId,
  onUploaded,
}: UsePhotoUploaderOptions): PhotoUploaderApi {
  const { studio } = useAuth();
  const [queue, setQueue] = React.useState<QueuedFile[]>([]);
  const queueRef = React.useRef<QueuedFile[]>([]);
  queueRef.current = queue;
  const inFlightRef = React.useRef<Set<string>>(new Set());
  const processingRef = React.useRef(false);

  const updateQueueItem = React.useCallback(
    (id: string, patch: Partial<QueuedFile>) => {
      setQueue((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const runUpload = React.useCallback(
    async (item: QueuedFile) => {
      if (!studio) return;
      updateQueueItem(item.id, { status: 'uploading', progress: 0 });
      try {
        const photo = await uploadAndCommitPhoto({
          studioId: studio.id,
          galleryId,
          file: item.file,
          onProgress: (progress) => updateQueueItem(item.id, { progress }),
        });
        updateQueueItem(item.id, { status: 'done', progress: 1 });
        // Fire-and-forget: let the API process the new photo for face
        // clustering. Failures are swallowed inside the service so the
        // upload itself never reports a clustering error to the user.
        void enqueuePhotoForClustering({ photo });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Falha desconhecida no upload.';
        updateQueueItem(item.id, { status: 'error', error: message });
      }
    },
    [galleryId, studio, updateQueueItem],
  );

  const processQueue = React.useCallback(async () => {
    if (!studio) return;
    if (processingRef.current) return;
    processingRef.current = true;

    const claimNext = (): QueuedFile | undefined => {
      const next = queueRef.current.find(
        (item) => item.status === 'queued' && !inFlightRef.current.has(item.id),
      );
      if (next) inFlightRef.current.add(next.id);
      return next;
    };

    try {
      const workers = Array.from({ length: MAX_PARALLEL_UPLOADS }).map(async () => {
        while (true) {
          const next = claimNext();
          if (!next) return;
          try {
            await runUpload(next);
          } finally {
            inFlightRef.current.delete(next.id);
          }
        }
      });

      await Promise.all(workers);

      const successCount = queueRef.current.filter(
        (item) => item.status === 'done',
      ).length;
      if (successCount > 0) onUploaded?.(successCount);
    } finally {
      processingRef.current = false;
    }
  }, [onUploaded, runUpload, studio]);

  const enqueueFiles = React.useCallback(
    (files: FileList | File[]) => {
      if (!studio) {
        toast.error('Sua conta ainda não tem um estúdio. Configure antes de subir fotos.');
        return;
      }
      const incoming: QueuedFile[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" não é uma imagem.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`"${file.name}" tem mais de 25 MB.`);
          continue;
        }
        incoming.push({ id: nextId(), file, progress: 0, status: 'queued' });
      }
      if (incoming.length === 0) return;
      setQueue((current) => [...current, ...incoming]);
      // Defer to a microtask so the setState commit propagates to queueRef
      // (which we update during render) before workers read it.
      queueMicrotask(() => {
        void processQueue();
      });
    },
    [processQueue, studio],
  );

  const dismissSettled = React.useCallback(() => {
    setQueue((current) =>
      current.filter((item) => item.status === 'queued' || item.status === 'uploading'),
    );
  }, []);

  const reset = React.useCallback(() => setQueue([]), []);

  const active = queue.some(
    (item) => item.status === 'queued' || item.status === 'uploading',
  );

  return {
    queue,
    enqueueFiles,
    dismissSettled,
    reset,
    active,
  };
}

/* ------------------------------------------------------------------------- */
/* PhotoUploaderTile — compact, square drop area                              */
/* ------------------------------------------------------------------------- */

interface PhotoUploaderTileProps {
  onSelect: (files: FileList | File[]) => void;
  /**
   * Optional indicator badge — e.g. number of files currently uploading.
   * Rendered in the bottom-right corner as a small pill.
   */
  uploadingCount?: number;
  className?: string;
}

/**
 * Square drop area sized to fit as the first item of a photo grid.
 * Identical interaction model as the original full-width uploader (click,
 * keyboard, drag-and-drop) — only the visual footprint changes.
 */
export function PhotoUploaderTile({
  onSelect,
  uploadingCount,
  className,
}: PhotoUploaderTileProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) onSelect(event.target.files);
    event.target.value = '';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) onSelect(event.dataTransfer.files);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Adicionar fotos"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        'group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card text-center transition-colors',
        'border-border hover:border-brand-500/60 hover:bg-brand-50/40',
        isDragging && 'border-brand-500 bg-brand-50/60',
        className,
      )}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
        <Upload className="size-4" />
      </span>
      <span className="px-3 text-[11px] font-medium leading-tight text-foreground sm:text-xs">
        Adicionar fotos
      </span>
      <span className="hidden px-3 text-[10px] leading-tight text-muted-foreground sm:block">
        Arraste ou clique
      </span>
      {uploadingCount && uploadingCount > 0 ? (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
          <Loader2 className="size-3 animate-spin" />
          {uploadingCount}
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* PhotoUploaderProgress — floating panel                                     */
/* ------------------------------------------------------------------------- */

interface PhotoUploaderProgressProps {
  queue: QueuedFile[];
  onDismissSettled: () => void;
}

/**
 * Fixed-position panel that lives at the bottom-right of the viewport and
 * only appears while there's something to show. The drop tile (above the
 * grid) keeps the page calm; this floats out only as feedback.
 */
export function PhotoUploaderProgress({
  queue,
  onDismissSettled,
}: PhotoUploaderProgressProps) {
  if (queue.length === 0) return null;

  const remaining = queue.filter((item) => item.status !== 'done').length;
  const succeeded = queue.length - remaining;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 sm:right-6 sm:bottom-6 sm:px-0">
      <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            {remaining > 0 ? (
              <Loader2 className="size-4 animate-spin text-brand-600" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600" />
            )}
            <span>
              {remaining > 0
                ? `Enviando ${succeeded} de ${queue.length}…`
                : `Concluído (${queue.length})`}
            </span>
          </div>
          {remaining === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissSettled}
              className="text-muted-foreground"
            >
              Limpar
            </Button>
          ) : null}
        </header>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {queue.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="size-8 shrink-0 overflow-hidden rounded bg-muted">
                <ThumbPreview file={item.file} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {item.file.name}
                </p>
                <ProgressBar status={item.status} progress={item.progress} />
                {item.error ? (
                  <p className="mt-1 truncate text-[11px] text-destructive">{item.error}</p>
                ) : null}
              </div>
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Small presentational helpers                                               */
/* ------------------------------------------------------------------------- */

function ThumbPreview({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

function ProgressBar({ status, progress }: { status: Status; progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-[width] duration-200',
            status === 'error' ? 'bg-destructive' : 'bg-brand-500',
          )}
          style={{ width: `${status === 'done' ? 100 : pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
        {status === 'done' ? '100%' : status === 'error' ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        Pronto
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
        <X className="size-3" /> Falhou
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {status === 'uploading' ? 'Enviando' : 'Aguardando'}
    </span>
  );
}
