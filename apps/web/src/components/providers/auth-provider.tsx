'use client';

import * as React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  FirestoreError,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';

import { auth } from '@/lib/firebase/client';
import { studioDoc, userDoc } from '@/lib/firebase/firestore';
import { healUserProfile } from '@/lib/services/user-profile-service';
import type { StudioDoc, UserDoc } from '@/types';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  profile: UserDoc | null;
  studio: StudioDoc | null;
  refreshProfile: () => Promise<void>;
}

/**
 * Best-effort detection of "ad-blocker / network filter is blocking Firestore"
 * scenarios. The Firestore SDK doesn't expose a stable error code for this —
 * we look at the wrapped error message which typically contains
 * `ERR_BLOCKED_BY_CLIENT` or just `Failed to fetch`.
 */
function isBlockedByClient(error: unknown): boolean {
  if (error instanceof FirestoreError && error.code === 'unavailable') return true;
  const message = (error as { message?: string })?.message ?? '';
  return /ERR_BLOCKED_BY_CLIENT|Failed to fetch|NetworkError/i.test(message);
}

const NETWORK_TOAST_ID = 'firestore-blocked';

function notifyNetworkBlocked(): void {
  toast.error(
    'Não foi possível conectar ao Firestore. Verifique se algum adblocker ou extensão está bloqueando *.googleapis.com.',
    { id: NETWORK_TOAST_ID, duration: 8000 },
  );
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * Source of truth for *who the current user is*. Wraps Firebase Auth and the
 * user/studio Firestore documents into a single hook so React components never
 * deal with the SDK directly.
 *
 *  - On sign-up, ensures a /users/{uid} document exists.
 *  - Live-subscribes to the studio (if any) so renames propagate instantly.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserDoc | null>(null);
  const [studio, setStudio] = React.useState<StudioDoc | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('loading');

  const loadProfile = React.useCallback(async (firebaseUser: User): Promise<UserDoc> => {
    const ref = userDoc(firebaseUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const profileData: UserDoc = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        studioId: null,
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, { ...profileData, createdAt: serverTimestamp() });
      return profileData;
    }

    return healUserProfile(firebaseUser, snap.data());
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!user) return;
    const next = await loadProfile(user);
    setProfile(next);
  }, [loadProfile, user]);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setStudio(null);
        setStatus('unauthenticated');
        return;
      }
      setUser(firebaseUser);
      try {
        const nextProfile = await loadProfile(firebaseUser);
        setProfile(nextProfile);
      } catch (error) {
        if (isBlockedByClient(error)) {
          notifyNetworkBlocked();
        } else {
          console.error('[auth] failed to load profile', error);
        }
        // Fallback: at least give the gate enough to make a decision so the
        // user isn't stuck on the splash forever. The dashboard will surface
        // the missing-studio state correctly.
        setProfile({
          id: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          studioId: null,
          createdAt: new Date().toISOString(),
        });
      } finally {
        setStatus('authenticated');
      }
    });
    return () => unsub();
  }, [loadProfile]);

  React.useEffect(() => {
    if (!profile?.studioId) {
      setStudio(null);
      return;
    }
    const unsub = onSnapshot(
      studioDoc(profile.studioId),
      (snap) => {
        setStudio(snap.exists() ? snap.data() : null);
      },
      (error) => {
        if (isBlockedByClient(error)) {
          notifyNetworkBlocked();
        } else {
          console.error('[auth] studio subscription error', error);
        }
      },
    );
    return () => unsub();
  }, [profile?.studioId]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, profile, studio, refreshProfile }),
    [status, user, profile, studio, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
