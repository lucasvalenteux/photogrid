'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Button, Input, Label } from '@photogrid/ui';

import { signInOrCreate, toAuthError } from '@/lib/firebase/auth';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Single-form auth entry.
 *
 *  - New email → account is created and the user is signed in.
 *  - Existing email + correct password → signed in.
 *  - Existing email + wrong password → friendly error.
 *
 * After a successful auth we always send the user to `/dashboard`. The
 * `<AuthGate requireStudio>` wrapping the dashboard layout will bounce
 * brand-new users to `/onboarding` automatically — keeping the routing
 * logic in one place.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!email.trim()) {
      toast.error('Informe seu email.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres na senha.`);
      return;
    }

    setSubmitting(true);
    try {
      const { outcome } = await signInOrCreate(email, password);
      if (outcome === 'created') {
        toast.success('Conta criada! Vamos configurar seu estúdio.');
      }
      startTransition(() => router.replace(ROUTES.dashboard));
    } catch (error) {
      const authError = toAuthError(error);
      toast.error(authError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loading = submitting || pending;

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Entre no Photogrid</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use seu email para entrar. Se for sua primeira vez, criamos sua conta
          automaticamente.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            disabled={loading}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={loading}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
          <p className="text-xs text-muted-foreground">
            Sua senha protege seu estúdio. Use pelo menos 8 caracteres.
          </p>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Entrando…' : 'Continuar'}
          {!loading ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </div>
  );
}
