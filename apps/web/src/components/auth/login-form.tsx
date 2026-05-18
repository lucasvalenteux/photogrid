'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import { Button, Input, Label } from '@photogrid/ui';

import {
  createUser,
  signInOrCreate,
  signInUser,
  toAuthError,
} from '@/lib/firebase/auth';
import {
  lookupEmailExists,
  type EmailLookupResult,
} from '@/lib/services/auth-service';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'password';

function errorCode(error: unknown): string {
  return (error as { code?: string })?.code ?? '';
}

/**
 * Two-step unified auth entry.
 *
 *   Step 1 — Email
 *     We ask the FastAPI service whether the email is registered. The
 *     answer drives the copy / button label on step 2 so the user
 *     never sees mismatched UI ("Create your account" while in fact
 *     they have one, etc.). If the lookup is unavailable (no
 *     `NEXT_PUBLIC_API_URL`, server down, network blip…) we degrade
 *     to neutral copy and let the legacy `signInOrCreate` fallback
 *     do the right thing.
 *
 *   Step 2 — Password
 *     With the lookup result in hand, we call exactly the right
 *     Firebase primitive (`signInUser` or `createUser`) so the error
 *     surface is precise — "Senha incorreta" stays "Senha incorreta",
 *     and "Senha muito fraca" only appears on the create path.
 *
 * Race-condition note: between step 1 and the create call on step 2 a
 * different tab/device might register the same email. We detect
 * `auth/email-already-in-use`, flip the local status to "exists" and
 * reset the password field so the user types the right one.
 *
 * After any successful auth we navigate to `/dashboard`. The
 * `<AuthGate requireStudio>` wrapping the dashboard layout still owns
 * the brand-new-user → onboarding redirect, which means the routing
 * logic lives in a single place.
 */
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState('');
  const [emailStatus, setEmailStatus] =
    React.useState<EmailLookupResult>('unknown');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [routerPending, startTransition] = React.useTransition();

  const passwordRef = React.useRef<HTMLInputElement>(null);

  // Focus the password field as soon as it appears.
  React.useEffect(() => {
    if (step === 'password') {
      passwordRef.current?.focus();
    }
  }, [step]);

  const loading = submitting || routerPending;

  const onEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      toast.error('Informe um email válido.');
      return;
    }

    setEmail(trimmed);
    setSubmitting(true);
    try {
      const status = await lookupEmailExists(trimmed);
      setEmailStatus(status);
      setStep('password');
    } finally {
      setSubmitting(false);
    }
  };

  const onPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres na senha.`);
      return;
    }

    setSubmitting(true);
    try {
      let outcome: 'signed_in' | 'created';

      if (emailStatus === 'exists') {
        outcome = (await signInUser(email, password)).outcome;
      } else if (emailStatus === 'new') {
        try {
          outcome = (await createUser(email, password)).outcome;
        } catch (createError) {
          if (errorCode(createError) === 'auth/email-already-in-use') {
            // Account showed up between step 1 and step 2 — most
            // likely the user finished sign-up in another tab. Pivot
            // the UI in place instead of throwing them back to step 1.
            setEmailStatus('exists');
            setPassword('');
            toast.error('Já existe uma conta com este email — entre com sua senha.');
            return;
          }
          throw createError;
        }
      } else {
        // Lookup was unavailable — fall back to the resilient combined
        // path. This is the same behaviour the form had before
        // step-splitting, so we never regress when the API is down.
        outcome = (await signInOrCreate(email, password)).outcome;
      }

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

  const onBackToEmail = () => {
    if (loading) return;
    setStep('email');
    setPassword('');
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
      <Header
        step={step}
        emailStatus={emailStatus}
        email={email}
        onBack={onBackToEmail}
        disabled={loading}
      />

      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'email' ? (
            <motion.form
              key="email"
              onSubmit={onEmailSubmit}
              className="space-y-4"
              noValidate
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username email"
                  autoFocus
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </div>

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? 'Verificando…' : 'Continuar'}
                {!loading ? <ArrowRight className="size-4" /> : null}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Sem conta? Criamos uma na próxima tela.
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="password"
              onSubmit={onPasswordSubmit}
              className="space-y-4"
              noValidate
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {/* Hidden email field so password managers can save the pair. */}
              <input
                type="email"
                name="email"
                autoComplete="username email"
                value={email}
                readOnly
                hidden
              />

              <div className="space-y-1.5">
                <Label htmlFor="password">
                  {emailStatus === 'new' ? 'Crie uma senha' : 'Sua senha'}
                </Label>
                <Input
                  id="password"
                  ref={passwordRef}
                  name="password"
                  type="password"
                  autoComplete={
                    emailStatus === 'new' ? 'new-password' : 'current-password'
                  }
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <p className="text-xs text-muted-foreground">
                  {emailStatus === 'new'
                    ? 'Use ao menos 8 caracteres. Essa senha protege seu estúdio.'
                    : 'A senha que você cadastrou ao criar a conta.'}
                </p>
              </div>

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading
                  ? emailStatus === 'new'
                    ? 'Criando…'
                    : 'Entrando…'
                  : emailStatus === 'new'
                    ? 'Criar conta'
                    : 'Entrar'}
                {!loading ? <ArrowRight className="size-4" /> : null}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface HeaderProps {
  step: Step;
  emailStatus: EmailLookupResult;
  email: string;
  onBack: () => void;
  disabled: boolean;
}

function Header({ step, emailStatus, email, onBack, disabled }: HeaderProps) {
  if (step === 'email') {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Entre no Photogrid
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use seu email para entrar. Se for sua primeira vez, criamos sua conta
          automaticamente.
        </p>
      </div>
    );
  }

  const title =
    emailStatus === 'exists'
      ? 'Bem-vindo de volta'
      : emailStatus === 'new'
        ? 'Crie sua conta'
        : 'Continue para o Photogrid';

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm">
        <span className="text-muted-foreground">{email}</span>
        <span className="text-muted-foreground/60">·</span>
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft className="size-3" />
          Trocar email
        </button>
      </div>
    </div>
  );
}
