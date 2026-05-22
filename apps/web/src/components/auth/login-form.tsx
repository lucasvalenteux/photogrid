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
  sendPasswordReset,
  signInOrCreate,
  signInUser,
  toAuthError,
  type AuthResult,
} from '@/lib/firebase/auth';
import { recordAccountAccess } from '@/lib/services/account-access-log-service';
import {
  lookupEmailExists,
  type EmailLookupResult,
} from '@/lib/services/auth-service';
import { isSystemAdmin } from '@/lib/admin/access';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 16px avoids iOS Safari auto-zoom on focus, which breaks the layout. */
const LOGIN_INPUT_CLASS = 'text-center text-base';

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
 *     If the lookup said "new" but Firebase rejects the create with
 *     `email-already-in-use` (lookup race, false negative, account
 *     created in another tab…) we transparently sign in with the
 *     password the user already typed. The visible recovery before
 *     this fix looked like the form "going back to the start" — even
 *     though the form really only swapped copy + cleared the password
 *     box, users perceived it as a failure.
 *
 * Form lifecycle: the underlying `<form>` element stays mounted across
 * step transitions; only the inner contents are swapped through
 * `AnimatePresence`. This avoids any chance of submit handlers or
 * focus state racing the React unmount/remount cycle of the form.
 *
 * After any successful auth we navigate to `/dashboard`. The
 * `<AuthGate requireStudio>` wrapping the dashboard layout still owns
 * the brand-new-user → onboarding redirect, which means the routing
 * logic lives in a single place. A `redirecting` flag locks the form
 * during navigation so it can't be re-submitted while the page is on
 * its way out.
 */
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState('');
  const [emailStatus, setEmailStatus] =
    React.useState<EmailLookupResult>('unknown');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [resettingPassword, setResettingPassword] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);

  const passwordRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  // Focus the right field on every step transition. Refs are used
  // (instead of `autoFocus`) so we don't fight `AnimatePresence`'s
  // exit/enter timing.
  React.useEffect(() => {
    const target = step === 'password' ? passwordRef.current : emailRef.current;
    if (!target) return;
    // Defer focus on the password step so the step transition finishes
    // before the mobile keyboard opens — reduces layout jump/zoom glitches.
    const delay = step === 'password' ? 200 : 0;
    const id = window.setTimeout(() => target.focus(), delay);
    return () => window.clearTimeout(id);
  }, [step]);

  const loading = submitting || redirecting || resettingPassword;
  const showForgotPassword =
    step === 'password' && emailStatus !== 'new';

  const navigateAfterAuth = React.useCallback((authenticatedEmail: string) => {
    setRedirecting(true);
    router.replace(
      isSystemAdmin(authenticatedEmail) ? ROUTES.admin : ROUTES.dashboard,
    );
  }, [router]);

  const goToPasswordStep = async (trimmedEmail: string) => {
    setSubmitting(true);
    try {
      const status = await lookupEmailExists(trimmedEmail);
      setEmailStatus(status);
      setStep('password');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPassword = async () => {
    setSubmitting(true);
    try {
      let outcome: 'signed_in' | 'created';
      let authResult: AuthResult;

      if (emailStatus === 'exists') {
        authResult = await signInUser(email, password);
        outcome = authResult.outcome;
      } else if (emailStatus === 'new') {
        try {
          authResult = await createUser(email, password);
          outcome = authResult.outcome;
        } catch (createError) {
          if (errorCode(createError) === 'auth/email-already-in-use') {
            authResult = await signInUser(email, password);
            outcome = authResult.outcome;
            setEmailStatus('exists');
          } else {
            throw createError;
          }
        }
      } else {
        authResult = await signInOrCreate(email, password);
        outcome = authResult.outcome;
      }

      if (outcome === 'created') {
        toast.success('Conta criada! Vamos configurar seu estúdio.');
      }

      void recordAccountAccess({
        userId: authResult.credential.user.uid,
        email: authResult.credential.user.email ?? email,
        event: 'login',
        path: '/login',
      }).catch((logError) => {
        console.warn('[login] access log failed', logError);
      });

      navigateAfterAuth(email);
    } catch (error) {
      const authError = toAuthError(error);
      toast.error(authError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (step === 'email') {
      const trimmed = email.trim();
      if (!EMAIL_REGEX.test(trimmed)) {
        toast.error('Informe um email válido.');
        return;
      }
      setEmail(trimmed);
      await goToPasswordStep(trimmed);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres na senha.`);
      return;
    }
    await submitPassword();
  };

  const onBackToEmail = () => {
    if (loading) return;
    setStep('email');
    setPassword('');
  };

  const onForgotPassword = async () => {
    if (loading || !email.trim()) return;
    setResettingPassword(true);
    try {
      await sendPasswordReset(email);
      toast.success(
        'Enviamos um email com o link para redefinir sua senha. Confira a caixa de entrada e o spam.',
      );
    } catch (error) {
      toast.error(toAuthError(error).message);
    } finally {
      setResettingPassword(false);
    }
  };

  const buttonLabel = (() => {
    if (step === 'email') return loading ? 'Verificando…' : 'Continuar';
    if (redirecting) return 'Redirecionando…';
    if (emailStatus === 'new') return loading ? 'Criando…' : 'Criar conta';
    return loading ? 'Entrando…' : 'Entrar';
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
      <Header
        step={step}
        emailStatus={emailStatus}
        email={email}
        onBack={onBackToEmail}
        disabled={loading}
      />

      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-sm flex-col items-center space-y-4"
        noValidate
      >
        {/* Email field — always rendered. On step 2 it stays hidden
            from view but mounted, so password managers can pair it
            with the password field and we never have to play the
            mount/unmount roulette inside the form. */}
        <div
          className={
            step === 'email' ? 'w-full space-y-1.5 text-center' : 'sr-only'
          }
          aria-hidden={step !== 'email'}
        >
          <Label htmlFor="email" className="block">
            Email
          </Label>
          <Input
            id="email"
            ref={emailRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username email"
            required
            disabled={loading || step !== 'email'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            className={LOGIN_INPUT_CLASS}
            tabIndex={step === 'email' ? 0 : -1}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 'password' ? (
            <motion.div
              key="password-fields"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full space-y-2 text-center"
            >
              <Label htmlFor="password" className="block">
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
                className={LOGIN_INPUT_CLASS}
              />
              <p className="text-xs text-muted-foreground">
                {emailStatus === 'new'
                  ? 'Use ao menos 8 caracteres. Essa senha protege seu estúdio.'
                  : 'A senha que você cadastrou ao criar a conta.'}
              </p>
              {showForgotPassword ? (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={loading}
                  className="text-xs font-medium text-brand-600 underline decoration-brand-600 underline-offset-4 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resettingPassword ? 'Enviando…' : 'Esqueci minha senha'}
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {buttonLabel}
          {!loading ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
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
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Entre no Photogrid
        </h1>
        <p className="text-sm text-muted-foreground">
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
    <div className="mb-6 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-sm text-muted-foreground">{email}</p>
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1 text-sm text-brand-600 underline decoration-brand-600 underline-offset-4 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowLeft className="size-3" />
        Trocar email
      </button>
    </div>
  );
}
