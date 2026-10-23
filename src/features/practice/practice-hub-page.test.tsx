import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOZE_STORAGE_KEY, createClozeSession } from '@/features/law-cloze/cloze';
import { mockExamScope } from './mock-exam';
import { writeQuizProgress } from './mock-exam-progress';
import { PracticeHubPage } from './practice-hub-page';
import type { PracticeOverview } from './practice-overview';
import { PRACTICE_SESSION_STORAGE_KEY } from './practice-session';

const overview: PracticeOverview = {
  quiz: { subjects: 4, questions: 2963 },
  cloze: { laws: 10, questions: 358 },
  mockExam: { subjects: 3, papers: 5 },
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('PracticeHubPage', () => {
  it('lists the three practices in order, each titled by a link to its page', () => {
    render(<PracticeHubPage overview={overview} />);

    expect(
      screen.getAllByRole('article').map((practice) => {
        const heading = within(practice).getByRole('heading', { level: 2 });
        return [
          heading.textContent,
          within(heading).getByRole('link').getAttribute('href'),
        ];
      }),
    ).toEqual([
      ['選擇題練習', '/practice/quiz'],
      ['法規克漏字', '/practice/law-cloze'],
      ['歷屆試題模擬考', '/practice/mock-exam'],
    ]);
  });

  it('describes each practice in words, with its size', () => {
    render(<PracticeHubPage overview={overview} />);

    const quiz = screen.getByRole('article', { name: '選擇題練習' });
    expect(within(quiz).getByText('從歷屆考古題抽題，逐題對答案')).toBeInTheDocument();
    expect(within(quiz).getByText('4 科・2,963 題')).toBeInTheDocument();
    const cloze = screen.getByRole('article', { name: '法規克漏字' });
    expect(within(cloze).getByText('背熟法規裡的期限、罰鍰與尺寸')).toBeInTheDocument();
    expect(within(cloze).getByText('10 部法規・358 題')).toBeInTheDocument();
    const exam = screen.getByRole('article', { name: '歷屆試題模擬考' });
    expect(
      within(exam).getByText('選一份歷屆試卷，照原題號作答，交卷後按配分算分'),
    ).toBeInTheDocument();
    expect(within(exam).getByText('3 科・5 份試卷')).toBeInTheDocument();
  });

  it('offers no shortcuts into a practice, even with progress saved in each', () => {
    window.localStorage.setItem(
      PRACTICE_SESSION_STORAGE_KEY,
      JSON.stringify({ id: 'set-1', subject: 'law', questionIds: ['law-114-01'] }),
    );
    window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(createClozeSession()));
    writeQuizProgress(mockExamScope('law', 114), {
      'law-114-01': {
        selected: 0,
        elapsedSeconds: 5,
        startedAt: '2026-10-01T00:00:00.000Z',
      },
    });
    render(<PracticeHubPage overview={overview} />);

    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is complete when prerendered, with nothing left for the browser to fill in', () => {
    const html = renderToString(<PracticeHubPage overview={overview} />);

    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('href="/practice/mock-exam"');
    expect(html).toContain('4 科・2,963 題');
  });
});
