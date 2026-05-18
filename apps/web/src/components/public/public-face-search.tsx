'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Button, Card } from '@photogrid/ui';

import { searchPublicFaces } from '@/lib/services/face-clustering-service';
import {
  publicFaceSearchStorageKey,
  type StoredPublicFaceSearch,
} from '@/lib/public-face-search-storage';

interface PublicFaceSearchProps {
  studio: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };
}

export function PublicFaceSearch({
  studio,
}: PublicFaceSearchProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem do rosto.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchPublicFaces({ studioId: studio.id, file });
      if (result.length === 0) {
        toast.info('Não encontramos fotos compatíveis com esse rosto.');
        return;
      }

      const payload: StoredPublicFaceSearch = {
        photoIds: Array.from(new Set(result.map((match) => match.photoId))),
        savedAt: Date.now(),
      };
      window.sessionStorage.setItem(
        publicFaceSearchStorageKey(studio.id),
        JSON.stringify(payload),
      );
      router.push(ROUTES.publicFaceSearch(studio.slug));
    } catch (error) {
      console.error('[public-face-search] failed', error);
      const message =
        error instanceof Error && error.message.includes('404')
          ? 'Busca em atualização. Tente novamente em instantes.'
          : 'Não foi possível buscar agora.';
      setSearchError(message);
      toast.error(message);
    } finally {
      setSearching(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full overflow-hidden p-3 shadow-xs lg:w-[360px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
            <Search className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">
              Buscar pelo rosto
            </h2>
            <p className="text-xs text-muted-foreground">
              Envie uma foto para encontrar imagens.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={searching}
          onClick={() => inputRef.current?.click()}
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {searching ? 'Buscando' : 'Enviar'}
        </Button>
      </div>

      {searchError ? (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {searchError}
        </p>
      ) : null}
    </Card>
  );
}

