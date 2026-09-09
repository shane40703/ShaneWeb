import { useEffect, useMemo, useRef } from 'react';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { useCloudSync } from '@/components/cloud-sync-provider';
import { useTheme } from '@/components/theme-provider';
import { getFirebaseServices } from '@/lib/firebase-client';
import {
  isThemePalette,
  validateThemePalette,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme';
import { useAppState } from '@/state/app-state';

const allowedFontSizes = new Set([14, 16, 18, 20, 22, 24]);

export interface AccountPreferences {
  mode: ThemeMode;
  customPalettes: Partial<Record<ThemeMode, ThemePalette>>;
  questionFontSize: number;
  optionFontSize: number;
}

function validFontSize(value: unknown): value is number {
  return typeof value === 'number' && allowedFontSizes.has(value);
}

export function parseCloudAccountPreferences(
  data: DocumentData,
): AccountPreferences | null {
  if (
    (data.mode !== 'light' && data.mode !== 'dark') ||
    !validFontSize(data.questionFontSize) ||
    !validFontSize(data.optionFontSize) ||
    !data.customPalettes ||
    typeof data.customPalettes !== 'object' ||
    Array.isArray(data.customPalettes)
  ) {
    return null;
  }

  const source = data.customPalettes as Record<string, unknown>;
  const customPalettes: Partial<Record<ThemeMode, ThemePalette>> = {};
  for (const mode of ['light', 'dark'] as const) {
    const palette = source[mode];
    if (palette === undefined) continue;
    if (!isThemePalette(palette) || !validateThemePalette(mode, palette).valid) {
      return null;
    }
    customPalettes[mode] = { ...palette };
  }

  return {
    mode: data.mode,
    customPalettes,
    questionFontSize: data.questionFontSize,
    optionFontSize: data.optionFontSize,
  };
}

function signature(preferences: AccountPreferences) {
  return JSON.stringify({
    mode: preferences.mode,
    customPalettes: {
      ...(preferences.customPalettes.light
        ? { light: preferences.customPalettes.light }
        : {}),
      ...(preferences.customPalettes.dark
        ? { dark: preferences.customPalettes.dark }
        : {}),
    },
    questionFontSize: preferences.questionFontSize,
    optionFontSize: preferences.optionFontSize,
  });
}

function toCloudDocument(preferences: AccountPreferences) {
  return {
    ...preferences,
    updatedAt: new Date().toISOString(),
    syncedAt: serverTimestamp(),
  };
}

/** Synchronizes account-scoped visual preferences after all local providers hydrate. */
export function AccountPreferencesSync() {
  const cloud = useCloudSync();
  const { state, dispatch, hydrated } = useAppState();
  const {
    mode,
    customPalettes,
    hydrated: themeHydrated,
    replacePreferences,
  } = useTheme();
  const readyUserId = useRef<string | null>(null);
  const syncedSignature = useRef('');
  const applyingRemoteSignature = useRef('');
  const localPreferences = useRef<AccountPreferences>({
    mode,
    customPalettes,
    ...state.readingPreferences,
  });
  const currentPreferences = useMemo<AccountPreferences>(
    () => ({
      mode,
      customPalettes,
      ...state.readingPreferences,
    }),
    [customPalettes, mode, state.readingPreferences],
  );
  const currentSignature = useMemo(
    () => signature(currentPreferences),
    [currentPreferences],
  );

  useEffect(() => {
    localPreferences.current = currentPreferences;
  }, [currentPreferences]);

  useEffect(() => {
    if (!cloud.user) {
      readyUserId.current = null;
      syncedSignature.current = '';
      applyingRemoteSignature.current = '';
      return;
    }
    if (!hydrated || !themeHydrated) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;

    let active = true;
    let stopListening: (() => void) | undefined;
    const userId = cloud.user.uid;
    const preferencesDocument = doc(
      firebase.db,
      'users',
      userId,
      'settings',
      'interface',
    );

    const applyRemote = (preferences: AccountPreferences) => {
      const remoteSignature = signature(preferences);
      syncedSignature.current = remoteSignature;
      if (signature(localPreferences.current) === remoteSignature) return;
      applyingRemoteSignature.current = remoteSignature;
      dispatch({
        type: 'set-reading-preferences',
        questionFontSize: preferences.questionFontSize,
        optionFontSize: preferences.optionFontSize,
      });
      replacePreferences(preferences.mode, preferences.customPalettes);
    };

    void (async () => {
      try {
        const initialSnapshot = await getDoc(preferencesDocument);
        if (!active) return;
        const remotePreferences = initialSnapshot.exists()
          ? parseCloudAccountPreferences(initialSnapshot.data())
          : null;
        if (remotePreferences) {
          applyRemote(remotePreferences);
        } else {
          const preferences = localPreferences.current;
          await setDoc(preferencesDocument, toCloudDocument(preferences));
          syncedSignature.current = signature(preferences);
        }
        if (!active) return;
        readyUserId.current = userId;
        stopListening = onSnapshot(preferencesDocument, (snapshot) => {
          if (!snapshot.exists()) return;
          const preferences = parseCloudAccountPreferences(snapshot.data());
          if (preferences) applyRemote(preferences);
        });
      } catch {
        // Local settings remain active. A later sign-in or local change retries sync.
      }
    })();

    return () => {
      active = false;
      stopListening?.();
      if (readyUserId.current === userId) readyUserId.current = null;
    };
  }, [cloud.user, dispatch, hydrated, replacePreferences, themeHydrated]);

  useEffect(() => {
    const user = cloud.user;
    if (!user || readyUserId.current !== user.uid) return;
    if (applyingRemoteSignature.current) {
      if (currentSignature === applyingRemoteSignature.current) {
        syncedSignature.current = currentSignature;
        applyingRemoteSignature.current = '';
      }
      return;
    }
    if (currentSignature === syncedSignature.current) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;

    const timeout = window.setTimeout(() => {
      void setDoc(
        doc(firebase.db, 'users', user.uid, 'settings', 'interface'),
        toCloudDocument(currentPreferences),
      ).then(() => {
        syncedSignature.current = currentSignature;
      }).catch(() => {
        // Keep the old signature so a later preference change retries the write.
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [cloud.user, currentPreferences, currentSignature]);

  return null;
}
