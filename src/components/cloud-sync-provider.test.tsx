import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudSyncProvider,
  useCloudSync,
} from '@/components/cloud-sync-provider';

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: { attempts: [] },
    dispatch: vi.fn(),
    hydrated: true,
  }),
}));

function Probe() {
  const cloud = useCloudSync();
  return <output aria-label="cloud status">{cloud.status}</output>;
}

describe('CloudSyncProvider', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
  });

  it('keeps the site in local-only mode when Firebase is not configured', () => {
    render(
      <CloudSyncProvider>
        <Probe />
      </CloudSyncProvider>,
    );

    expect(screen.getByLabelText('cloud status')).toHaveTextContent('disabled');
  });
});
