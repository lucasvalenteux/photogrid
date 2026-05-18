'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { APP_DOMAIN, ROUTES } from '@photogrid/config';
import { Button, Input, Label } from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import { createStudio } from '@/lib/services/studio-service';
import { slugify, SLUG_ERROR_MESSAGES, validateSlug } from '@/lib/slug';

export function StudioForm() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const previewSlug = React.useMemo(() => slugify(name) || 'seu-estudio', [name]);
  const slugError = React.useMemo(() => {
    if (!name.trim()) return null;
    return validateSlug(previewSlug);
  }, [name, previewSlug]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || submitting) return;

    if (name.trim().length < 2) {
      toast.error('Digite o nome do seu estúdio.');
      return;
    }

    if (slugError) {
      toast.error(SLUG_ERROR_MESSAGES[slugError]);
      return;
    }

    setSubmitting(true);
    try {
      const { slug } = await createStudio({ ownerId: user.uid, name });
      await refreshProfile();
      toast.success(`Estúdio criado em photogrid.store/${slug}`);
      router.replace(ROUTES.dashboard);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível criar o estúdio.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-brand-600">
          Quase lá
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Qual o nome da sua empresa de fotografia?
        </h1>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">
          Esse será o nome exibido para seus clientes e também sua URL pública.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="studio-name">Nome do estúdio</Label>
          <Input
            id="studio-name"
            name="studio-name"
            type="text"
            required
            autoFocus
            autoComplete="organization"
            disabled={submitting}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Maria Fotografia"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/50 px-3.5 py-3">
          <p className="text-xs text-muted-foreground">Seu endereço público</p>
          <p className="mt-0.5 font-mono text-sm text-ink">
            {APP_DOMAIN}/<span className="text-brand-600">{previewSlug}</span>
          </p>
          {slugError ? (
            <p className="mt-1 text-xs text-destructive">{SLUG_ERROR_MESSAGES[slugError]}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
          disabled={Boolean(slugError) || !name.trim()}
        >
          {submitting ? 'Criando…' : 'Criar estúdio'}
          {!submitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </div>
  );
}
