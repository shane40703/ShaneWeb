import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { buildForecastRanking, DetailedTrendAnalysis } from '@/features/analysis/detailed-trend-analysis';
import { chartColors } from '@/lib/chart-colors';
import type { Question, QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  pathname: '/analysis',
  query: {} as Record<string, string>,
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

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

function playable(summary: QuestionSummary): Question {
  return {
    ...summary,
    content: [{ kind: 'text', text: summary.text }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

describe('AnalysisPage category quiz', () => {
  beforeEach(() => {
    router.query = { subject: 'law', year: '114' };
    router.push.mockReset();
    router.push.mockResolvedValue(true);
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

  it('starts all questions of the selected category directly and keeps the existing links', async () => {
    const questions = [
      question('law-114-01', 1),
      question('law-114-02', 2),
    ];
    render(<AnalysisPage questions={questions} practiceQuestions={questions.map(playable)} />);

    expect(screen.getByRole('link', { name: /law-114-02 題幹/ })).toHaveAttribute(
      'href',
      '/exams/law/114/2',
    );
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));

    expect(router.push).toHaveBeenCalledWith('/practice/quiz?q=1');
    const saved = JSON.parse(window.localStorage.getItem('shaneweb:practice-session')!);
    expect(saved).toMatchObject({ category: '建築技術規則', rangeStart: 114, rangeEnd: 114 });
    expect(saved.questionIds.sort()).toEqual(['law-114-01', 'law-114-02']);
    await waitFor(() => expect(screen.getByRole('button', { name: '作答此分類所有題目' })).toBeEnabled());
  });

  it('asks before replacing a 每日抽題練習 set in progress', async () => {
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
    const first = question('law-114-01', 1);
    render(<AnalysisPage questions={[first]} practiceQuestions={[playable(first)]} />);

    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    expect(confirm).toHaveBeenCalledWith(
      '目前的每日抽題練習還沒完成，要放棄並改用這個類別抽題嗎？作答進度會清除。',
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('shaneweb:practice-session')).not.toBeNull();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    expect(JSON.parse(window.localStorage.getItem('shaneweb:practice-session')!).questionIds).toEqual(['law-114-01']);
    expect(router.push).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: '作答此分類所有題目' })).toBeEnabled());
  });

  it('starts only the questions in a secondary related-law category', async () => {
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
    render(<AnalysisPage questions={questions} practiceQuestions={questions.map(playable)} />);

    fireEvent.click(
      screen.getByRole('button', { name: /建築技術規則1 題/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '作答此分類所有題目' }),
    );

    expect(router.push).toHaveBeenCalledWith('/practice/quiz?q=1');
    expect(JSON.parse(window.localStorage.getItem('shaneweb:practice-session')!).questionIds).toEqual(['law-114-01']);
    await waitFor(() => expect(screen.getByRole('button', { name: '作答此分類所有題目' })).toBeEnabled());
  });

  it('starts more than 50 eligible questions, including all-credit, and excludes obsolete questions', async () => {
    router.query = { subject: 'law', year: 'all', fromYear: '103', toYear: '114' };
    const questions = Array.from({ length: 60 }, (_, index) => question(`law-114-${String(index + 1).padStart(2, '0')}`, index + 1));
    const obsolete = [
      { ...question('law-103-56', 56), year: 103 },
      { ...question('law-104-24', 24), year: 104 },
    ];
    const bank = [...questions.map(playable), ...obsolete.map(playable)];
    bank[0].answerKey = { kind: 'all-credit' };
    render(<AnalysisPage questions={[...questions, ...obsolete]} practiceQuestions={bank} />);
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    const saved = JSON.parse(window.localStorage.getItem('shaneweb:practice-session')!);
    expect(saved.questionIds).toHaveLength(60);
    expect(saved.questionIds).toContain(bank[0].id);
    obsolete.forEach((item) => expect(saved.questionIds).not.toContain(item.id));
    await waitFor(() => expect(screen.getByRole('button', { name: '作答此分類所有題目' })).toBeEnabled());
  });

  it('uses analysis classification, rather than unrelated tags, for non-law subjects', async () => {
    router.query = { subject: 'env', year: '114' };
    const thermal = [1, 2].map((number) => ({
      ...question(`env-114-0${number}`, number), subject: 'env' as const,
      topic: '熱環境', primaryCategory: '熱', relatedLaws: ['共同標記'],
    }));
    const other = { ...question('env-114-03', 3), subject: 'env' as const,
      topic: '通風', primaryCategory: '空氣', relatedLaws: ['共同標記'] };
    const summaries = [...thermal, other];
    render(<AnalysisPage questions={summaries} practiceQuestions={summaries.map(playable)} />);
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    const saved = JSON.parse(localStorage.getItem('shaneweb:practice-session')!);
    expect(saved.category).toBe('熱');
    expect(saved.questionIds.sort()).toEqual(['env-114-01', 'env-114-02']);
    await waitFor(() => expect(screen.getByRole('button', { name: '作答此分類所有題目' })).toBeEnabled());
  });

  it('preserves the previous set when storage or navigation fails', async () => {
    const first = question('law-114-01', 1);
    const previous = JSON.stringify({ version: 1, id: 'previous', subject: 'law', questionIds: ['law-114-09'] });
    localStorage.setItem('shaneweb:practice-session', previous);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<AnalysisPage questions={[first]} practiceQuestions={[playable(first)]} />);
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    expect(screen.getByRole('alert')).toHaveTextContent('無法儲存練習進度');
    expect(localStorage.getItem('shaneweb:practice-session')).toBe(previous);
    expect(router.push).not.toHaveBeenCalled();
    write.mockRestore();
    router.push.mockRejectedValueOnce(new Error('failed'));
    fireEvent.click(screen.getByRole('button', { name: '作答此分類所有題目' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('無法開啟練習'));
    expect(localStorage.getItem('shaneweb:practice-session')).toBe(previous);
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

  it('searches comparison categories without changing the selected lines', () => {
    const questions = [
      question('law-114-01', 1),
      { ...question('law-114-02', 2), relatedLaws: ['都市計畫法'] },
      { ...question('law-114-03', 3), relatedLaws: ['建築法'] },
    ];
    render(<AnalysisPage questions={questions} />);
    fireEvent.click(screen.getByText('詳細趨勢分析'));
    const picker = screen.getByRole('group', { name: '比較分類清單' });
    const search = screen.getByRole('searchbox', { name: '搜尋比較分類' });
    expect(within(picker).getAllByRole('checkbox', { checked: true })).toHaveLength(3);
    const chart = screen.getByRole('region', { name: '跨年度分類折線圖' });
    const lineCount = chart.querySelectorAll('polyline').length;
    fireEvent.change(search, { target: { value: '都市' } });
    expect(within(picker).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(picker).getByRole('checkbox', { name: /都市計畫法/ })).toBeChecked();
    expect(chart.querySelectorAll('polyline')).toHaveLength(lineCount);
    fireEvent.change(search, { target: { value: '沒有此分類' } });
    expect(within(picker).getByRole('status')).toHaveTextContent('找不到符合的分類');
    fireEvent.change(search, { target: { value: '' } });
    expect(within(picker).getAllByRole('checkbox', { checked: true })).toHaveLength(3);
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
