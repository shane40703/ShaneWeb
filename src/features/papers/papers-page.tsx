'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EmptyState, PageHeader, QuestionRow } from '@/components/content/content';
import { SimpleSelect, useToast } from '@/components/ui/ui';
import { questions, subjects, years } from '@/data/questions';
import { filterPapers, parsePaperFilters } from '@/lib/study';
import { useAppState } from '@/state/app-state';
import styles from './papers-page.module.css';

const yearOptions = [
  { value: 'all', label: '全部年度' },
  ...years.map((year) => ({ value: String(year), label: `民國 ${year} 年` })),
];

const subjectOptions = [
  { value: 'all', label: '全部科目' },
  ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
];

const statusOptions = [
  { value: 'all', label: '全部狀態' },
  { value: 'unanswered', label: '未作答' },
  { value: 'answered', label: '已作答' },
  { value: 'wrong', label: '答錯' },
];

export function PapersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const filters = parsePaperFilters(new URLSearchParams(searchParams.toString()));
  const visibleQuestions = filterPapers(questions, state.answers, filters);

  function updateFilter(name: 'year' | 'subject' | 'status', value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all') next.delete(name);
    else next.set(name, value);
    const query = next.toString();
    router.replace(query ? `/papers?${query}` : '/papers', { scroll: false });
  }

  function toggleDifficult(questionId: number) {
    const active = state.difficultQuestionIds.includes(questionId);
    dispatch({ type: 'toggle-difficult', questionId });
    notify(active ? '已取消難題標記' : '已加入難題標記');
  }

  return (
    <>
      <PageHeader
        eyebrow="PAST EXAMS"
        title="歷屆試題"
        description="依年度、科目與作答狀態縮小範圍，找到今天要練習的題目。"
        action={<span className={styles.resultCount}>{visibleQuestions.length} 題</span>}
      />
      <section className={styles.filterCard} aria-label="篩選題目">
        <div className={styles.filterIntro}>
          <span className={styles.filterIcon} aria-hidden="true">
            ≡
          </span>
          <div>
            <strong>篩選題庫</strong>
            <p>條件會同步保留在網址中</p>
          </div>
        </div>
        <div className={styles.filters}>
          <SimpleSelect
            label="年度"
            value={String(filters.year)}
            options={yearOptions}
            onValueChange={(value) => updateFilter('year', value)}
          />
          <SimpleSelect
            label="科目"
            value={filters.subject}
            options={subjectOptions}
            onValueChange={(value) => updateFilter('subject', value)}
          />
          <SimpleSelect
            label="狀態"
            value={filters.status}
            options={statusOptions}
            onValueChange={(value) => updateFilter('status', value)}
          />
        </div>
      </section>

      <div className={styles.listHeader}>
        <div>
          <strong>題目列表</strong>
          <span>依年度由新到舊排列</span>
        </div>
        <span className={styles.legend}>
          <span aria-hidden="true">★</span> 點擊可加入難題
        </span>
      </div>

      <section className={styles.questionList} aria-live="polite">
        {visibleQuestions.length ? (
          visibleQuestions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              answer={state.answers[question.id]}
              difficult={state.difficultQuestionIds.includes(question.id)}
              onToggleDifficult={() => toggleDifficult(question.id)}
            />
          ))
        ) : (
          <div className={styles.emptyCard}>
            <EmptyState
              symbol="⌕"
              title="沒有符合條件的題目"
              description="試著調整年度、科目或作答狀態，再查看可練習的題目。"
            />
          </div>
        )}
      </section>
    </>
  );
}
