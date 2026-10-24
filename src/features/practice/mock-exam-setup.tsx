import Link from 'next/link';
import { IconArrowRight, IconFileText, IconRotate } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { formatDateTime, getSubjectScoreConfig } from '@/lib/study';
import type { QuizAttempt, SubjectId } from '@/lib/types';
import { getSubject, subjects } from '@/question-bank/catalog';
import {
  formatMockExamScore,
  getMockExamAttempts,
  getMockExamScore,
  mockExamHref,
  type MockExamDraft,
  type MockExamPaper,
} from './mock-exam';
import styles from './practice-page.module.css';
import examStyles from './mock-exam.module.css';

/** Chooses a paper and starts, resumes or restarts it. Nothing here needs the question bank. */
export function MockExamSetup({
  papers,
  paper,
  drafts,
  attempts,
  onSubjectChange,
  onYearChange,
  onStart,
  onResume,
  onRestart,
}: {
  papers: readonly MockExamPaper[];
  paper: MockExamPaper;
  drafts: readonly MockExamDraft[];
  attempts: readonly QuizAttempt[];
  onSubjectChange: (subject: SubjectId) => void;
  onYearChange: (year: number) => void;
  onStart: () => void;
  onResume: (index: number) => void;
  onRestart: () => void;
}) {
  const subject = getSubject(paper.subject);
  const subjectPapers = papers.filter((item) => item.subject === paper.subject);
  const { pointsPerQuestion, maximumScore } = getSubjectScoreConfig(paper.subject);
  const draftOf = (item: MockExamPaper) =>
    drafts.find(
      (draft) => draft.paper.subject === item.subject && draft.paper.year === item.year,
    );
  const draft = draftOf(paper);
  const latest = getMockExamAttempts(attempts, paper.subject, paper.year)[0];

  return (
    <section className={styles.setup} aria-label="歷屆試題模擬考設定">
      <fieldset className={styles.subjectChoices}>
        <legend>選擇科目</legend>
        {subjects.map((item) => {
          const checked = item.id === paper.subject;
          const count = papers.filter(
            (candidate) => candidate.subject === item.id,
          ).length;
          return (
            <label key={item.id} data-checked={checked || undefined}>
              <input
                type="radio"
                name="mock-exam-subject"
                checked={checked}
                disabled={!count}
                onChange={() => onSubjectChange(item.id)}
              />
              <span>
                <strong>{item.name}</strong>
                <small>{count ? `${count} 份試卷` : '準備中'}</small>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className={examStyles.years}>
        <legend>選擇年度</legend>
        <div className={examStyles.yearGrid}>
          {subjectPapers.map((item) => {
            const checked = item.year === paper.year;
            const itemDraft = draftOf(item);
            const itemLatest = getMockExamAttempts(attempts, item.subject, item.year)[0];
            return (
              <label
                key={item.year}
                data-checked={checked || undefined}
                data-draft={itemDraft ? true : undefined}
              >
                <input
                  type="radio"
                  name="mock-exam-year"
                  checked={checked}
                  onChange={() => onYearChange(item.year)}
                />
                <strong>{item.year} 年</strong>
                {itemDraft ? (
                  <small>
                    作答中 {itemDraft.answered}／{itemDraft.total}
                  </small>
                ) : itemLatest ? (
                  <small>
                    上次{' '}
                    {formatMockExamScore(
                      getMockExamScore(itemLatest, item.subject).score,
                    )}{' '}
                    分
                  </small>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={examStyles.paperSummary}>
        <h2>
          {subject?.name}・{paper.year} 年
        </h2>
        <p>
          選擇題 {paper.questionCount} 題，每題 {pointsPerQuestion} 分，滿分{' '}
          {maximumScore} 分。照原題號作答，交卷後才對答案；中途離開會保留進度。
        </p>
        {paper.writtenCount && paper.firstWrittenId ? (
          <p>
            這份試卷另有申論題 {paper.writtenCount} 題，不列入模擬考計分，
            <Link href={`/exams?question=${paper.firstWrittenId}`}>
              到考古題討論版閱讀
              <IconFileText size={14} aria-hidden="true" />
            </Link>
          </p>
        ) : null}
        {latest ? (
          <p className={examStyles.latest}>
            上次交卷 {formatDateTime(latest.submittedAt)}・
            {formatMockExamScore(getMockExamScore(latest, paper.subject).score)} 分
            <Link
              href={mockExamHref({
                subject: paper.subject,
                year: paper.year,
                result: latest.id,
              })}
            >
              查看結果
              <IconArrowRight size={14} aria-hidden="true" />
            </Link>
          </p>
        ) : null}
      </div>

      <footer className={styles.setupFooter}>
        <span>
          {draft
            ? `作答中：已作答 ${draft.answered}／${draft.total} 題`
            : `已選 ${subject?.shortName}・${paper.year} 年・${paper.questionCount} 題`}
        </span>
        <div className={styles.setupActions}>
          {draft ? (
            <>
              <Button onClick={onRestart}>
                <IconRotate size={16} aria-hidden="true" /> 重新開始
              </Button>
              <Button variant="primary" onClick={() => onResume(draft.resumeIndex)}>
                繼續作答（第 {draft.resumeIndex + 1} 題）
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={onStart}>
              開始作答
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}
