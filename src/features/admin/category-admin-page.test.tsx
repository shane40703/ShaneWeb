import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryAdminPage } from '@/features/admin/category-admin-page';
import type { Question, QuestionSummary } from '@/lib/types';

const summary: QuestionSummary = {
  id: 'law-114-01',
  subject: 'law',
  year: 114,
  questionNumber: 1,
  primaryCategory: '建築法',
  topic: '建築法',
  tags: ['建築法'],
  text: '測試題幹',
  path: '/questions/law/114/01',
};

const updatedQuestion: Question = {
  ...summary,
  primaryCategory: '建築技術規則',
  topic: '建築技術規則',
  relatedLaws: ['建築法', '建築技術規則'],
  content: [{ kind: 'text', text: summary.text }],
  options: ['A', 'B', 'C', 'D'],
  answerKey: { kind: 'accepted', options: [0] },
  source: { kind: 'sample' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CategoryAdminPage', () => {
  it('filters questions needing review and sends an authenticated classification update', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ question: updatedQuestion }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CategoryAdminPage questions={[summary]} />);

    expect(screen.getByText('1 題')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('作者編輯金鑰'), {
      target: { value: 'author-key' },
    });
    fireEvent.change(screen.getByLabelText('主分類'), {
      target: { value: '建築技術規則' },
    });
    fireEvent.change(
      screen.getByLabelText('相關法規（每行一項，可複數）'),
      {
        target: { value: '建築法\n建築技術規則\n建築法' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: '驗證並儲存' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/classification',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'X-Author-Key': 'author-key' }),
        body: JSON.stringify({
          questionId: summary.id,
          primaryCategory: '建築技術規則',
          topic: '建築技術規則',
          relatedLaws: ['建築法', '建築技術規則'],
        }),
      }),
    );
    expect(
      await screen.findByText('分類已驗證並寫回題庫 meta.json。'),
    ).toBeInTheDocument();
  });
});
