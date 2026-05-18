import {
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { systemSettingsDoc } from '@/lib/firebase/firestore';
import type { PlatformSettingsDoc } from '@/types';

const PLATFORM_SETTINGS_ID = 'platform' as const;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsDoc = {
  id: PLATFORM_SETTINGS_ID,
  redirectHomeToAutoLogin: false,
  updatedAt: null,
  updatedBy: null,
};

export async function getPlatformSettings(): Promise<PlatformSettingsDoc> {
  const snap = await getDoc(systemSettingsDoc(PLATFORM_SETTINGS_ID));
  return snap.exists()
    ? { ...DEFAULT_PLATFORM_SETTINGS, ...snap.data() }
    : DEFAULT_PLATFORM_SETTINGS;
}

export function subscribeToPlatformSettings(
  onChange: (settings: PlatformSettingsDoc) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    systemSettingsDoc(PLATFORM_SETTINGS_ID),
    (snap) => {
      onChange(
        snap.exists()
          ? { ...DEFAULT_PLATFORM_SETTINGS, ...snap.data() }
          : DEFAULT_PLATFORM_SETTINGS,
      );
    },
    (error) => onError?.(error),
  );
}

export async function updateHomeRedirectSetting({
  enabled,
  updatedBy,
}: {
  enabled: boolean;
  updatedBy: string;
}): Promise<void> {
  await setDoc(
    systemSettingsDoc(PLATFORM_SETTINGS_ID),
    {
      id: PLATFORM_SETTINGS_ID,
      redirectHomeToAutoLogin: enabled,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}

