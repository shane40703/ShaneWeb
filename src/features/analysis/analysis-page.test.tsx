import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { buildForecastRanking, DetailedTrendAnalysis } from '@/features/analysis/detailed-trend-analysis';
import { chartColors } from '@/lib/chart-colors';
import type { QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  pathname: '/analysis',
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
  };
}

describe('AnalysisPage category quiz', () => {
  beforeEach(() => {
    router.query = { subject: 'law', year: '114' };
    router.push.mockReset();
    router.replace.mockReset();
  });

  it('filters the distribution by keyword without changing the overall chart totals', () => {
    render(<AnalysisPage questions={[
      question('law-114-01', 1),
      { ...question('law-114-02', 2), relatedLaws: ['都市計畫法'] },
    ]} />);
    const distribution = screen.getByRole('region', { name: '命題分類與對應考古題' });
    const search = within(distribution).getByRole('searchbox', { name: '搜尋相關法規' });
    fireEvent.change(search, { target: { value: '都市' } });
    expect(within(distribution).getByRole('button', { name: /都市計畫法/ })).toBeInTheDocument();
    expect(within(distribution).queryByRole('button', { name: /建築技術規則/ })).not.toBeInTheDocument();
    expect(within(distribution).getByRole('link', { name: /law-114-02 題幹/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /建築技術規則.*都市計畫法|都市計畫法.*建築技術規則/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '沒有此分類' } });
    expect(within(distribution).getByRole('status')).toHaveTextContent('找不到符合的分類');
    fireEvent.change(search, { target: { value: '' } });
    expect(within(distribution).getByRole('button', { name: /建築技術規則/ })).toBeInTheDocument();
  });

  it.each([
    ['env', '熱', '空氣'],
    ['construction', '混凝土構造', '鋼構造'],
    ['structure', '力學', '耐震'],
  ] as const)('sorts the %s distribution by descending count', (subject, low, high) => {
    router.query = { subject, year: '114' };
    const make = (index: number, category: string): QuestionSummary => ({
      ...question(`${subject}-114-${index}`, index), subject,
      topic: category, primaryCategory: category, relatedLaws: [],
    });
    render(<AnalysisPage questions={[make(1, low), make(2, high), make(3, high)]} />);
    const distribution = screen.getByRole('region', { name: '命題分類與對應考古題' });
    const rows = within(distribution).getAllByRole('button', { pressed: true });
    expect(rows[0]).toHaveTextContent(high);
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

  it('opens 每日抽題練習 with the category and year, and each question in 歷屆試題討論版', () => {
    const questions = [
      question('law-114-01', 1),
      question('law-114-02', 2),
    ];
    render(<AnalysisPage questions={questions} />);

    expect(screen.getByRole('link', { name: /law-114-02 題幹/ })).toHaveAttribute(
      'href',
      '/exams/law/114/2',
    );
    fireEvent.click(screen.getByRole('button', { name: '到每日抽題練習抽題' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/practice/quiz',
      query: { subject: 'law', from: '114', to: '114', category: '建築技術規則' },
    });
  });

  it('asks before replacing a 每日抽題練習 set in progress', () => {
    window.localStorage.setItem(
      'shaneweb:practice-session',
      JSON.stringify({
        version: 1,
        id: 'current',
        subject: 'law',
        questionIds: ['law-114-09'],
        answers: { 'law-114-09': { selected: 0, correct: true } },
      }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    render(<AnalysisPage questions={[question('law-114-01', 1)]} />);

    fireEvent.click(screen.getByRole('button', { name: '到每日抽題練習抽題' }));
    expect(confirm).toHaveBeenCalledWith(
      '目前的每日抽題練習還沒完成，要放棄並改用這個類別抽題嗎？作答進度會清除。',
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('shaneweb:practice-session')).not.toBeNull();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '到每日抽題練習抽題' }));
    expect(window.localStorage.getItem('shaneweb:practice-session')).toBeNull();
    expect(router.push).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
    window.localStorage.clear();
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
      screen.getByRole('button', { name: '到每日抽題練習抽題' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/practice/quiz',
      query: { subject: 'law', from: '114', to: '114', category: '建築技術規則' },
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

  it('uses all seven ordered colors for lines and legends and caps comparison at seven', () => {
    render(<DetailedTrendAnalysis
      questions={Array.from({ length: 8 }, (_, index) => ({
        ...question(`law-114-${index}`, index + 1),
        fineTopic: `考點 ${index + 1}`,
      }))}
      subjectId="law"
      years={[114]}
      colors={chartColors}
    />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));
    fireEvent.change(screen.getByLabelText('趨勢分析層級'), {
      target: { value: 'fine-topic' },
    });
    const checkboxes = within(screen.getByRole('group', { name: '比較分類清單' }))
      .getAllByRole('checkbox');
    for (const checkbox of checkboxes.slice(3, 7)) fireEvent.click(checkbox);
    expect(screen.getByText('已選 7／7')).toBeInTheDocument();
    expect(checkboxes[7]).toBeDisabled();
    const chart = screen.getByRole('region', { name: '跨年度分類折線圖' });
    expect(Array.from(chart.querySelectorAll('polyline'), (line) => line.getAttribute('stroke')))
      .toEqual(chartColors);
    expect(Array.from(chart.querySelectorAll('i'), (swatch) => swatch.style.background))
      .toEqual(chartColors);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[7]).toBeEnabled();
    fireEvent.click(checkboxes[7]);
    expect(Array.from(chart.querySelectorAll('polyline'), (line) => line.getAttribute('stroke')))
      .toEqual(chartColors);
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

  it('keeps an empty chart in place and filters its own year range', () => {
    router.query = { subject: 'law', year: '114' };
    const questions = [
      question('law-114-01', 1),
      { ...question('law-113-01', 1), year: 113 },
      { ...question('law-112-01', 1), year: 112 },
    ];

    render(<AnalysisPage questions={questions} />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));
    fireEvent.change(screen.getByLabelText('趨勢起始年度'), {
      target: { value: '113' },
    });

    const chart = screen.getByRole('region', { name: '跨年度分類折線圖' });
    expect(
      within(chart).getByRole('img', { name: '113 年至 114 年分類出題數量折線圖' }),
    ).toBeInTheDocument();
    expect(within(chart).getByText('出題數（題）')).toBeInTheDocument();
    expect(within(chart).getByText('年份')).toBeInTheDocument();
    expect(within(chart).getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /建築技術規則/ }));

    expect(screen.getByRole('region', { name: '跨年度分類折線圖' })).toBeInTheDocument();
    expect(within(chart).getByText('勾選分類後顯示折線')).toBeInTheDocument();
    expect(screen.getByText('尚未選取比較分類')).toBeInTheDocument();
  });

  it('keeps the trend chart compact and uses five automatic y-axis intervals', () => {
    const questions = Array.from({ length: 27 }, (_, index) =>
      question(`law-114-${String(index + 1).padStart(2, '0')}`, index + 1),
    );

    render(<AnalysisPage questions={questions} />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));

    const chart = screen.getByRole('region', { name: '跨年度分類折線圖' });
    const graphic = within(chart).getByRole('img');
    expect(graphic).toHaveAttribute('viewBox', '0 0 820 320');
    expect(within(chart).getByText('7')).toBeInTheDocument();
    expect(within(chart).queryByText('27')).not.toBeInTheDocument();
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

describe('AnalysisPage routing', () => {
  beforeEach(() => {
    router.query = { subject: 'law', year: '114' };
    router.replace.mockReset();
  });

  afterEach(() => {
    router.pathname = '/analysis';
  });

  it('keeps subject changes on the route it was opened from, such as the resources hub', () => {
    router.pathname = '/resources/analysis';
    render(
      <AnalysisPage
        questions={[
          question('law-114-01', 1),
          { ...question('env-114-01', 1), subject: 'env' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /建築環境控制/ }));

    expect(router.replace).toHaveBeenCalledWith(
      { pathname: '/resources/analysis', query: { subject: 'env', year: '114' } },
      undefined,
      { shallow: true, scroll: false },
    );
  });
});
