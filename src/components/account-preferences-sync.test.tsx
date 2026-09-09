import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountPreferencesSync,
  parseCloudAccountPreferences,
} from '@/components/account-preferences-sync';
import { DEFAULT_THEME_PALETTES } from '@/lib/theme';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  replacePreferences: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@/components/cloud-sync-provider', () => ({
  useCloudSync: () => ({ user: { uid: 'user-1' } }),
}));

vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({
    mode: 'light',
    customPalettes: {},
    hydrated: true,
    replacePreferences: mocks.replacePreferences,
  }),
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      readingPreferences: {
        questionFontSize: 18,
        optionFontSize: 20,
      },
    },
    dispatch: mocks.dispatch,
    hydrated: true,
  }),
}));

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseServices: () => ({ db: { name: 'test-db' } }),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...parts: unknown[]) => parts.slice(1).join('/'),
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: () => 'server-time',
  setDoc: mocks.setDoc,
}));

describe('parseCloudAccountPreferences', () => {
  it('accepts valid account theme and reading preferences', () => {
    expect(parseCloudAccountPreferences({
      mode: 'dark',
      customPalettes: { dark: DEFAULT_THEME_PALETTES.dark },
      questionFontSize: 22,
      optionFontSize: 20,
    })).toEqual({
      mode: 'dark',
      customPalettes: { dark: DEFAULT_THEME_PALETTES.dark },
      questionFontSize: 22,
      optionFontSize: 20,
    });
  });

  it('rejects unsupported sizes and malformed palettes', () => {
    expect(parseCloudAccountPreferences({
      mode: 'dark',
      customPalettes: {},
      questionFontSize: 15,
      optionFontSize: 18,
    })).toBeNull();
    expect(parseCloudAccountPreferences({
      mode: 'light',
      customPalettes: { light: { accent: '#000000' } },
      questionFontSize: 18,
      optionFontSize: 18,
    })).toBeNull();
  });
});

describe('AccountPreferencesSync', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.getDoc.mockReset();
    mocks.onSnapshot.mockReset();
    mocks.replacePreferences.mockReset();
    mocks.setDoc.mockReset();
    mocks.onSnapshot.mockReturnValue(vi.fn());
    mocks.setDoc.mockResolvedValue(undefined);
  });

  it('applies an existing account preference document to the device', async () => {
    const remote = {
      mode: 'dark',
      customPalettes: { dark: DEFAULT_THEME_PALETTES.dark },
      questionFontSize: 24,
      optionFontSize: 16,
    };
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => remote,
    });

    render(<AccountPreferencesSync />);

    await waitFor(() => {
      expect(mocks.dispatch).toHaveBeenCalledWith({
        type: 'set-reading-preferences',
        questionFontSize: 24,
        optionFontSize: 16,
      });
      expect(mocks.replacePreferences).toHaveBeenCalledWith(
        'dark',
        { dark: DEFAULT_THEME_PALETTES.dark },
      );
    });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('creates account preferences from the current device on first sign-in', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    render(<AccountPreferencesSync />);

    await waitFor(() => expect(mocks.setDoc).toHaveBeenCalledOnce());
    expect(mocks.setDoc.mock.calls[0][0]).toContain(
      'users/user-1/settings/interface',
    );
    expect(mocks.setDoc.mock.calls[0][1]).toMatchObject({
      mode: 'light',
      customPalettes: {},
      questionFontSize: 18,
      optionFontSize: 20,
      syncedAt: 'server-time',
    });
  });
});
