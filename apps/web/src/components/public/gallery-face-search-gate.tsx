'use client';

import * as React from 'react';
import { Loader2, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@photogrid/ui';

interface GalleryFaceSearchGateProps {
  onSearch: (file: File) => Promise<void>;
  searching: boolean;
  error: string | null;
}

/**
 * Centered face-upload gate shown on partially-private galleries. Kept
 * visually distinct from the compact studio-wide search card on the
 * studio home page.
 */
export function GalleryFaceSearchGate({
  onSearch,
  searching,
  error,
}: GalleryFaceSearchGateProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem do rosto.');
      return;
    }
    await onSearch(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
        <Search className="size-5" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
        Buscar pelo rosto
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Envie uma foto para encontrar imagens.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />

      <Button
        type="button"
        size="lg"
        className="mt-6 min-w-40"
        disabled={searching}
        onClick={() => inputRef.current?.click()}
      >
        {searching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {searching ? 'Buscando…' : 'Enviar'}
      </Button>

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
