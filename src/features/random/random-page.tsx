import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { IconArrowRight, IconArrowsShuffle } from '@tabler/icons-react';
import { EmptyState, PageHeader } from '@/components/content/content';
import {
  Button,
  QuantityField,
  SimpleSelect,
  ToggleSwitch,
  useToast,
} from '@/components/ui/ui';
import { subjects, years } from '@/data/questions';
import { buildQuiz } from '@/lib/study';
import type { PracticeFilters, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './random-page.module.css';

const subjectOptions = [
  { value: 'all', label: '全部科目' },
  ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
] as const;

const yearOptions = years.map((year) => ({ value: String(year), label: `民國 ${year} 年` }));

export function RandomPage() {
  const router = useRouter();
  const { state } = useAppState();
  const { notify } = useToast();
  const [filters, setFilters] = useState<PracticeFilters>({
    subject: 'all',
    fromYear: 102,
    toYear: 114,
    count: 10,
    onlyUnanswered: false,
    onlyDifficult: false,
  });

  function startRandom(event: FormEvent) {
    event.preventDefault();
    const quiz = buildQuiz(filters, state);
    if (!quiz.length) {
      notify('沒有符合條件的題目', '請放寬年度範圍或取消目前的篩選條件。');
      return;
    }
    void router.push({
      pathname: '/quiz',
      query: { mode: 'random', questions: quiz.map((question) => question.id).join(',') },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="RANDOM PRACTICE"
        title="隨機出題"
        description="選好範圍後立即組卷；進入作答頁時，計時器會自動啟動。"
      />
      <div className={styles.layout}>
        <form className={styles.formCard} onSubmit={startRandom}>
          <SimpleSelect
            label="科目"
            value={filters.subject}
            options={subjectOptions}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                subject: value as SubjectId | 'all',
              }))
            }
          />
          <div className={styles.yearFields}>
            <SimpleSelect
              label="開始年度"
              value={String(filters.fromYear)}
              options={yearOptions}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, fromYear: Number(value) }))
              }
            />
            <SimpleSelect
              label="結束年度"
              value={String(filters.toYear)}
              options={yearOptions}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, toYear: Number(value) }))
              }
            />
          </div>
          <QuantityField
            label="題目數量"
            value={filters.count}
            min={1}
            max={20}
            onValueChange={(value) => setFilters((current) => ({ ...current, count: value }))}
          />
          <div className={styles.switches}>
            <ToggleSwitch
              label="只出未作答題目"
              checked={filters.onlyUnanswered}
              onCheckedChange={(checked) =>
                setFilters((current) => ({ ...current, onlyUnanswered: checked }))
              }
            />
            <ToggleSwitch
              label="只出已標記難題"
              checked={filters.onlyDifficult}
              onCheckedChange={(checked) =>
                setFilters((current) => ({ ...current, onlyDifficult: checked }))
              }
            />
          </div>
          <Button type="submit" variant="primary" fullWidth>
            產生題目並開始 <IconArrowRight size={18} stroke={2} aria-hidden="true" />
          </Button>
        </form>
        <section className={styles.previewCard}>
          <EmptyState
            icon={IconArrowsShuffle}
            title="從題庫打散練習"
            description="可跨科目、跨年度抽題。答題紀錄、筆記與難題標記都只保存在目前瀏覽器。"
          />
        </section>
      </div>
    </>
  );
}
