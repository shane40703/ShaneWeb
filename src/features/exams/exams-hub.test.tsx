import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import {
  questionRefs,
  type PaperIndex,
  type PaperTopics,
  type QuestionEntry,
} from '@/question-bank/derived-data';
import { ExamsHub, type ExamsHubPlace } from './exams-hub';

afterEach(cleanup);

const years = Array.from({ length: 15 }, (_, index) => 114 - index);
/** The bank's shape: 60 papers, 3,672 questions, 72 of them written (37 環控, 35 結構). */
const index: PaperIndex = {
  law: years.map((year) => [year, 80, 0] as const),
  env: years.map((year, position) => [year, 40, position < 7 ? 3 : 2] as const),
  construction: years.map((year) => [year, 80, 0] as const),
  structure: years.map((year, position) => [year, 40, position < 5 ? 3 : 2] as const),
};
const refs = questionRefs(index);

const law114Labels = Array.from({ length: 80 }, (_, position) =>
  position < 21
    ? '建築技術規則'
    : position < 30
      ? '建築法'
      : position < 35
        ? '建築物無障礙設施設計規範'
        : `其他法規 ${position}`,
);
const law114: PaperTopics = {
  subject: 'law',
  year: 114,
  rows: law114Labels.map((label, position) => [
    `law-114-${String(position + 1).padStart(2, '0')}`,
    [label],
  ]),
};

function body(ref: QuestionEntry, topic = '熱環境'): Question {
  return {
    ...ref,
    topic,
    primaryCategory: topic,
    tags: [],
    text: `${ref.id} 的題幹`,
    content: [{ kind: 'text', text: `${ref.id} 的題幹` }],
    options: ['甲', '乙', '丙', '丁'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

/** The lead, by its whole text: each count in it sits in a span that keeps it on one line. */
function lead(text: string | RegExp) {
  return screen.getByText((_, element) => {
    if (element?.tagName !== 'P') return false;
    const content = element.textContent ?? '';
    return typeof text === 'string' ? content === text : text.test(content);
  });
}

function hub(
  place: ExamsHubPlace,
  props: Partial<React.ComponentProps<typeof ExamsHub>> = {},
) {
  return (
    <ExamsHub
      place={place}
      questions={refs}
      status="ready"
      onNavigate={() => {}}
      {...props}
    />
  );
}

describe('ExamsHub: 考古題討論版 itself', () => {
  it('says what the bank holds and lists the four subjects as facts, no links', () => {
    render(hub({ kind: 'bank' }));

    expect(
      lead(
        '建築師考試（專門職業及技術人員高等考試建築師考試）四個科目的歷屆試題：民國 100 至 114 年，共 60 份試卷、3,672 題，其中申論題 72 題。每一題都有自己的頁面，可以先作答再看解答，也能在討論區留下詳解或提問。在上方選一個科目，就從那一科最新一年的第 1 題開始。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('3,672 題').tagName).toBe('SPAN');
    const rows = screen.getAllByRole('article');
    expect(rows.map((row) => row.querySelector('h2')?.textContent)).toEqual([
      '營建法規與實務 法規',
      '建築環境控制 環控',
      '建築構造與施工 構造',
      '建築結構 結構',
    ]);
    // The selector above the page chooses a subject.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '營建法規與實務 法規' }),
    ).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('建築法規、都市計畫、建築管理與實務應用');
    expect(rows[0]).toHaveTextContent('100–114 年・15 份・選擇題 1,200 題');
    expect(rows[1]).toHaveTextContent('100–114 年・15 份・申論題 37 題・選擇題 600 題');
    expect(rows[3]).toHaveTextContent('100–114 年・15 份・申論題 35 題・選擇題 600 題');
    // A narrow row breaks its figure only at a ・, never inside 「選擇題 600 題」.
    expect(
      within(rows[3])
        .getAllByText(/^(100–114 年|15 份|申論題 35 題|選擇題 600 題)$/)
        .map((part) => part.tagName),
    ).toEqual(['SPAN', 'SPAN', 'SPAN', 'SPAN']);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('starts at the lead after a move inside the page, and not on a full load', () => {
    const { rerender } = render(hub({ kind: 'bank' }));
    expect(lead(/四個科目的歷屆試題/)).not.toHaveFocus();

    rerender(hub({ kind: 'subject', subject: 'law' }, { focusLead: true }));
    expect(lead(/^營建法規與實務（法規）/)).toHaveFocus();
  });
});

describe('ExamsHub: a subject', () => {
  it('lists its fifteen papers, newest first, with their counts, as facts', () => {
    render(hub({ kind: 'subject', subject: 'law' }));

    expect(
      lead(
        '營建法規與實務（法規）：建築法規、都市計畫、建築管理與實務應用。民國 100 至 114 年每年一份試卷，共 15 份、選擇題 1,200 題。在上方選一個年度，就從那一年的第 1 題開始。',
      ),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('article');
    expect(rows.map((row) => row.querySelector('h2')?.textContent)).toEqual(
      years.map((year) => `${year} 年`),
    );
    expect(rows[0]).toHaveAccessibleName('114 年');
    expect(rows[0]).toHaveTextContent('選擇題 80 題');
    // The selector above the page chooses a year.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('counts written questions first, as the paper prints them', () => {
    render(hub({ kind: 'subject', subject: 'env' }));

    expect(
      lead(
        '建築環境控制（環控）：環境物理、熱濕空氣、光環境、音環境與設備。民國 100 至 114 年每年一份試卷，共 15 份，申論題 37 題、選擇題 600 題。在上方選一個年度，就從那一年的第 1 題開始。',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).toHaveTextContent(
      '申論題 3 題・選擇題 40 題',
    );
  });
});

describe('ExamsHub: a paper', () => {
  it('lists every question once, with its topics, and no question text', () => {
    const bodies = refs.map((ref) => (ref.subject === 'law' ? body(ref) : ref));
    render(
      hub(
        { kind: 'paper', subject: 'law', year: 114 },
        { questions: bodies, paperTopics: law114 },
      ),
    );

    expect(
      lead(
        '民國 114 年建築師考試營建法規與實務（法規）試卷，選擇題 80 題。考得最多的是建築技術規則（21 題）、建築法（9 題）與建築物無障礙設施設計規範（5 題）。點任一題就能作答、看解答和討論。',
      ),
    ).toBeInTheDocument();
    // 「（21 題）」 stays on one line.
    expect(screen.getByText('21 題').tagName).toBe('SPAN');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(80);
    expect(links[0]).toHaveAttribute('href', '/exams/law/114/1');
    expect(links[0]).toHaveAccessibleName('第 1 題 建築技術規則');
    expect(links[79]).toHaveAttribute('href', '/exams/law/114/80');
    expect(screen.getByRole('heading', { name: '選擇題 80 題' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /申論題/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/的題幹/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('puts the written questions first, under their own heading', () => {
    const env114: PaperTopics = {
      subject: 'env',
      year: 114,
      rows: refs
        .filter((ref) => ref.subject === 'env' && ref.year === 114)
        .map((ref) => [ref.id, [ref.format === 'written' ? '熱環境' : '光環境']]),
    };
    render(hub({ kind: 'paper', subject: 'env', year: 114 }, { paperTopics: env114 }));

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs.slice(0, 4)).toEqual([
      '/exams/env/114/written-1',
      '/exams/env/114/written-2',
      '/exams/env/114/written-3',
      '/exams/env/114/1',
    ]);
    expect(hrefs).toHaveLength(43);
    expect(screen.getByRole('link', { name: '申論第 1 題 熱環境' })).toBeInTheDocument();
    const [written, choice] = screen.getAllByRole('heading', { level: 2 });
    expect(written).toHaveAccessibleName('申論題 3 題');
    expect(choice).toHaveAccessibleName('選擇題 40 題');
  });

  it('lists the questions at once after a move, and their topics when the paper arrives', () => {
    const place = { kind: 'paper', subject: 'law', year: 113 } as const;
    const { rerender } = render(hub(place, { paperTopics: law114, status: 'loading' }));

    expect(screen.getByRole('status')).toHaveTextContent('正在載入考點…');
    expect(screen.getAllByRole('link')).toHaveLength(80);
    expect(screen.getAllByRole('link')[0]).toHaveAccessibleName('第 1 題');
    expect(screen.queryByText(/考得最多/)).not.toBeInTheDocument();

    const loaded = refs.map((ref) =>
      ref.subject === 'law' && ref.year === 113
        ? body(ref, ref.questionNumber <= 2 ? '建築法' : '都市計畫法')
        : ref,
    );
    rerender(hub(place, { paperTopics: law114, questions: loaded }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAccessibleName('第 1 題 建築法');
    expect(lead(/考得最多的是都市計畫法（78 題）與建築法（2 題）。/)).toBeInTheDocument();
    expect(screen.queryByText(/的題幹/)).not.toBeInTheDocument();
  });

  it('offers a retry when the paper cannot be downloaded, and keeps the rows', () => {
    const retry = vi.fn();
    const place = { kind: 'paper', subject: 'law', year: 113 } as const;
    const { rerender } = render(hub(place, { status: 'loading', onRetry: retry }));
    const status = screen.getByRole('status');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(hub(place, { status: 'error', onRetry: retry }));
    // The same live region with new words, so a screen reader announces the failure.
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('考點暫時無法載入。');
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('link')).toHaveLength(80);
  });

  it('opens a question from its row and leaves a new tab to the browser', () => {
    const navigate = vi.fn();
    render(
      hub(
        { kind: 'paper', subject: 'law', year: 114 },
        { paperTopics: law114, onNavigate: navigate },
      ),
    );
    const third = screen.getByRole('link', { name: /^第 3 題/ });

    expect(fireEvent.click(third)).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['law', '114', '3']);
    expect(fireEvent.click(third, { shiftKey: true })).toBe(true);
    expect(navigate).toHaveBeenCalledOnce();
  });
});
