import { describe, expect, it } from 'vitest';
import {
  resolveFirebaseAuthDomain,
  resolveFirebaseStorageBucket,
} from '@/lib/firebase-client';

describe('resolveFirebaseAuthDomain', () => {
  it("signs in through the site's own address, where /__/auth/ is forwarded", () => {
    expect(
      resolveFirebaseAuthDomain('project-id.firebaseapp.com', {
        protocol: 'https:',
        host: 'exam-tw.vercel.app',
      }),
    ).toBe('exam-tw.vercel.app');
  });

  it('keeps the configured domain where Firebase cannot build an https address', () => {
    expect(
      resolveFirebaseAuthDomain('project-id.firebaseapp.com', {
        protocol: 'http:',
        host: 'localhost:3000',
      }),
    ).toBe('project-id.firebaseapp.com');
    expect(resolveFirebaseAuthDomain('project-id.firebaseapp.com', undefined)).toBe(
      'project-id.firebaseapp.com',
    );
  });
});

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
