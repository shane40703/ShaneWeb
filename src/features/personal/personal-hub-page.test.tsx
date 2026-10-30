import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { QuizAttempt } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { PersonalHubPage } from './personal-hub-page';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const attempt = (
  id: string,
  submittedAt: string,
  correctCount: number,
  wrongCount: number,
): QuizAttempt => ({
  id,
  mode: 'practice',
  subject: 'law',
  year: null,
  questionIds: [],
  answers: {},
  startedAt: submittedAt,
  submittedAt,
  elapsedSeconds: 60,
  correctCount,
  wrongCount,
  unansweredCount: 3,
});

describe('PersonalHubPage', () => {
  it('lists the five personal pages in order, each titled by a link to its page', () => {
    render(<PersonalHubPage today="2026-10-26" />);

    expect(
      screen.getAllByRole('article').map((row) => {
        const heading = within(row).getByRole('heading', { level: 2 });
        return [
          heading.textContent,
          within(heading).getByRole('link').getAttribute('href'),
        ];
      }),
    ).toEqual([
      ['我的筆記', '/notes'],
      ['難題標記', '/difficult'],
      ['常錯題目', '/wrong'],
      ['每日練習履歷', '/practice-history'],
      ['歷屆試題作答履歷', '/history'],
    ]);
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('describes what each page keeps', () => {
    render(<PersonalHubPage today="2026-10-26" />);

    expect(
      within(screen.getByRole('article', { name: '每日練習履歷' })).getByText(
        '選擇儲存的每日抽題練習紀錄',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: '歷屆試題作答履歷' })).getByText(
        '歷屆試題模擬考的作答紀錄',
      ),
    ).toBeInTheDocument();
  });

  it('sums the saved attempts in the heatmap above the links', async () => {
    const state = createDefaultState();
    state.attempts = [
      attempt('second', '2026-10-25T17:30:00.000Z', 18, 2),
      attempt('first', '2026-10-24T02:00:00.000Z', 7, 5),
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(
      <ToastProvider>
        <AppStateProvider>
          <PersonalHubPage today="2026-10-26" />
        </AppStateProvider>
      </ToastProvider>,
    );

    const heading = await screen.findByRole('heading', { name: '近一年寫了 32 題' });
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '過去一年每天的作答題數熱力圖，共 32 題，2 天有作答',
    );
    expect(
      heading.compareDocumentPosition(screen.getByRole('link', { name: '我的筆記' })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('stays empty without the app state provider', () => {
    render(<PersonalHubPage today="2026-10-26" />);
    expect(screen.getByRole('heading', { name: '近一年寫了 0 題' })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '過去一年每天的作答題數熱力圖，共 0 題，0 天有作答',
    );
  });

  it('prerenders the links without freezing the build date', () => {
    const html = renderToString(<PersonalHubPage />);
    expect(html.match(/<a /g)).toHaveLength(5);
    expect(html).toContain('href="/practice-history"');
    expect(html).toContain('近一年寫了 <!-- -->—<!-- --> 題');
  });
});
