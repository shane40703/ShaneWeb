import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { buildForecastRanking } from '@/features/analysis/detailed-trend-analysis';
import type { QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

afterEach(cleanup);

function question(id: string, questionNumber: number): QuestionSummary {
  return {
    id,
    subject: 'law',
    year: 114,
    questionNumber,
    primaryCategory: '建築技術規則',
    topic: '建築技術規則',
    tags: ['建築技術規則'],
    relatedLaws: ['建築技術規則'],
    text: `${id} 題幹`,
    path: `/questions/law/114/${String(questionNumber).padStart(2, '0')}`,
  };
}

describe('AnalysisPage category quiz', () => {
  beforeEach(() => {
    router.query = { subject: 'law', year: '114' };
    router.push.mockReset();
    router.replace.mockReset();
  });

  it('filters cross-year analysis by a selected year range', () => {
    router.query = {
      subject: 'law',
      year: 'all',
      fromYear: '113',
      toYear: '114',
    };
    const questions = [
      question('law-114-01', 1),
      { ...question('law-113-01', 1), id: 'law-113-01', year: 113 },
      { ...question('law-112-01', 1), id: 'law-112-01', year: 112 },
    ];

    render(<AnalysisPage questions={questions} />);

    expect(screen.queryByText(/總題數/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('分析起始年度')).toHaveValue('113');
    expect(screen.getByLabelText('分析結束年度')).toHaveValue('114');
  });

  it('starts a quiz containing every question in the selected category', () => {
    const questions = [
      question('law-114-01', 1),
      question('law-114-02', 2),
    ];
    render(<AnalysisPage questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', { name: '作答全部 2 題' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: questions[0].path,
      query: {
        mode: 'random',
        questions: 'law-114-01,law-114-02',
      },
    });
  });

  it('can start from a secondary related-law category', () => {
    const questions = [
      {
        ...question('law-114-01', 1),
        relatedLaws: ['建築法', '建築技術規則'],
      },
      {
        ...question('law-114-02', 2),
        primaryCategory: '建築法',
        topic: '建築法',
        relatedLaws: ['建築法'],
      },
    ];
    render(<AnalysisPage questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', { name: /建築技術規則1 題/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '作答全部 1 題' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: questions[0].path,
      query: {
        mode: 'random',
        questions: questions[0].id,
      },
    });
  });

  it('compares selected law categories across years with exact counts', () => {
    router.query = {
      subject: 'law',
      year: 'all',
      fromYear: '112',
      toYear: '114',
    };
    const questions = [
      question('law-114-01', 1),
      question('law-114-02', 2),
      { ...question('law-113-01', 1), year: 113 },
      {
        ...question('law-112-01', 1),
        year: 112,
        primaryCategory: '建築法',
        topic: '建築法',
        relatedLaws: ['建築法'],
      },
    ];

    render(<AnalysisPage questions={questions} />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));

    expect(
      screen.getByRole('region', { name: '跨年度分類折線圖' }),
    ).toBeInTheDocument();
    expect(screen.getByText('各年度精確出題數')).toBeInTheDocument();
    expect(screen.getAllByText('114 年・2 題')).not.toHaveLength(0);
    expect(screen.getByText('選取項目總標註')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '115 年複習優先度' })).toBeInTheDocument();
    expect(screen.getByText('115 年複習優先度')).toBeInTheDocument();
    expect(screen.getByText(/不是命題機率/)).toBeInTheDocument();
  });

  it('can compare manually assigned fine topics', () => {
    router.query = {
      subject: 'law',
      year: 'all',
      fromYear: '113',
      toYear: '114',
    };
    const questions = [
      { ...question('law-114-01', 1), fineTopic: '防火區劃' },
      { ...question('law-114-02', 2) },
      { ...question('law-113-01', 1), year: 113, fineTopic: '防火區劃' },
    ];

    render(<AnalysisPage questions={questions} />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));
    fireEvent.change(screen.getByLabelText('趨勢分析層級'), {
      target: { value: 'fine-topic' },
    });

    expect(screen.getAllByText('防火區劃')).not.toHaveLength(0);
    expect(screen.getByText('67% 資料覆蓋率')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /分類出題數量折線圖/ }),
    ).toBeInTheDocument();
  });

  it('ranks stable and rising topics with explainable forecast metrics', () => {
    const ranking = buildForecastRanking(
      [
        { category: '穩定高頻', counts: [2, 2, 2, 3, 3, 4], total: 16 },
        { category: '近期升溫', counts: [0, 0, 0, 0, 1, 3], total: 4 },
        { category: '近期降溫', counts: [4, 4, 3, 1, 0, 0], total: 12 },
      ],
      [109, 110, 111, 112, 113, 114],
    );

    expect(ranking[0].category).toBe('穩定高頻');
    expect(ranking[0].score).toBeGreaterThan(ranking[2].score);
    expect(ranking.find((item) => item.category === '近期升溫')?.momentum).toBeGreaterThan(0);
    expect(ranking.find((item) => item.category === '近期降溫')?.signal).toBe('近期降溫');
    expect(ranking.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);
  });
});
