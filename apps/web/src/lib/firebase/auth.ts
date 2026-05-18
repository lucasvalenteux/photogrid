import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth';

import { auth } from './client';

export interface AuthError {
  code: string;
  message: string;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Email inválido.',
  'auth/weak-password': 'Senha muito fraca. Use ao menos 8 caracteres.',
  'auth/user-not-found': 'Email ou senha incorretos.',
  'auth/wrong-password': 'Email ou senha incorretos.',
  'auth/invalid-credential': 'Email ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente em instantes.',
  'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
  'auth/operation-not-allowed':
    'Login por email/senha não está habilitado neste projeto Firebase.',
};

/** Whether this auth result corresponds to a newly-created account. */
export type AuthOutcome = 'created' | 'signed_in';

export interface AuthResult {
  credential: UserCredential;
  outcome: AuthOutcome;
}

/**
 * Normalise the Firebase error shape into a flat, user-friendly object so the
 * UI never has to know about Firebase internals.
 */
export function toAuthError(error: unknown): AuthError {
  const code = (error as { code?: string })?.code ?? 'auth/unknown';
  return {
    code,
    message: AUTH_ERROR_MESSAGES[code] ?? 'Algo deu errado. Tente novamente.',
  };
}

/** Sign-in failure codes that mean "credentials didn't match an existing account". */
const SIGNIN_MISS_CODES = new Set([
  'auth/invalid-credential', // email enumeration protection collapses errors into this
  'auth/user-not-found',
  'auth/invalid-login-credentials',
]);

/** Create-account failure codes that mean "the email already exists". */
const EMAIL_IN_USE_CODES = new Set([
  'auth/email-already-in-use',
  'auth/email-already-exists',
]);

const errorCode = (error: unknown): string =>
  (error as { code?: string })?.code ?? '';

/**
 * Unified entry point — signs the user in if the account exists, otherwise
 * creates it. Designed to be the only auth call the UI ever makes.
 *
 * Flow (sign-in-first, which avoids a noisy `:signUp` 400 for the common
 * "returning user" path):
 *
 *   1. Attempt `signInWithEmailAndPassword`.
 *      - 200 → returning user, signed in.                          (1 call)
 *   2. If the failure looks like "no such account / bad credential":
 *      a. Attempt `createUserWithEmailAndPassword`.
 *         - 200 → brand-new account, signed in.                    (2 calls)
 *         - `auth/email-already-in-use` → the account DID exist,
 *           which means step 1 failed because the password was
 *           wrong. Re-throw the original sign-in error so the user
 *           sees "Email ou senha incorretos".                       (2 calls)
 *      - Any other create error bubbles up (e.g. weak password).
 *   3. Any other sign-in error bubbles up (rate-limited, network, etc.).
 */
export async function signInOrCreate(
  email: string,
  password: string,
): Promise<AuthResult> {
  const normalisedEmail = email.trim().toLowerCase();

  let signInError: unknown;
  try {
    const credential = await signInWithEmailAndPassword(auth, normalisedEmail, password);
    return { credential, outcome: 'signed_in' };
  } catch (error) {
    if (!SIGNIN_MISS_CODES.has(errorCode(error))) {
      throw error;
    }
    signInError = error;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalisedEmail, password);
    return { credential, outcome: 'created' };
  } catch (createError) {
    if (EMAIL_IN_USE_CODES.has(errorCode(createError))) {
      // Account existed all along → original sign-in error was the right one.
      throw signInError;
    }
    throw createError;
  }
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

export type { User };
