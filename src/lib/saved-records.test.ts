import { describe, expect, it } from 'vitest';
import { createDefaultState } from '@/lib/study';
import type { AppState, QuizAttempt } from '@/lib/types';
import { countSavedRecords } from './saved-records';

const savedNothing = createDefaultState();

describe('countSavedRecords', () => {
  it('counts nothing when nothing is saved', () => {
    expect(countSavedRecords(savedNothing)).toBe(0);
  });

  it('adds up attempts, notes and difficult marks', () => {
    expect(
      countSavedRecords({
        ...savedNothing,
        attempts: [{ id: 'one' }, { id: 'two' }] as QuizAttempt[],
        notes: { 'law-114-01': '筆記' },
        difficultQuestionIds: ['law-114-02'],
      }),
    ).toBe(4);
  });

  it('leaves out notes with nothing in them', () => {
    expect(countSavedRecords({ ...savedNothing, notes: { 'law-114-01': '  \n' } })).toBe(
      0,
    );
  });

  it('counts a note with only images, once even with text too', () => {
    const image = { id: 'image', name: 'a.png', dataUrl: 'data:image/png;base64,' };
    expect(
      countSavedRecords({
        ...savedNothing,
        notes: { 'law-114-01': '', 'law-114-02': '筆記' },
        noteImages: {
          'law-114-01': [image],
          'law-114-02': [image],
          'law-114-03': [],
        } as unknown as AppState['noteImages'],
      }),
    ).toBe(2);
  });
});
