import { describe, expect, it } from 'vitest';
import { resolveFirebaseStorageBucket } from '@/lib/firebase-client';

describe('resolveFirebaseStorageBucket', () => {
  it('uses the explicitly configured bucket', () => {
    expect(resolveFirebaseStorageBucket('project-id', 'custom.appspot.com')).toBe(
      'custom.appspot.com',
    );
  });

  it('derives the current Firebase bucket when deployment omitted the variable', () => {
    expect(resolveFirebaseStorageBucket('project-id', undefined)).toBe(
      'project-id.firebasestorage.app',
    );
  });
});
