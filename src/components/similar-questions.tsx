import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/ui';
import { getLawQuestionFineTopic } from '@/lib/law-question-topics';
import { useSimilarRows } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import type { Question } from '@/lib/types';
import type { SimilarRow } from '@/question-bank/derived-data';
import styles from './similar-questions.module.css';

const SeedContext = createContext<readonly SimilarRow[]>([]);

/** The rows that shipped with the page, so the prerendered question shows them too. */
export function SimilarRowsSeed({
  rows,
  children,
}: {
  rows: readonly SimilarRow[];
  children: ReactNode;
}) {
  return <SeedContext.Provider value={rows}>{children}</SeedContext.Provider>;
}

/** Rows shown before 顯示全部; the newest years come first. */
const PREVIEW_COUNT = 8;

/** Whether `SimilarQuestions` renders for this question: a 法規 question with a fine topic. */
export function hasSimilarQuestionsBlock(question: Question) {
  return getLawQuestionFineTopic(question) !== null;
}

/**
 * 類似考題: the other 法規 questions on the same fine topic, newest year first, each a link to
 * that question on `basePath`. Frameless: the exams page's panel or the note editor frames it.
 */
export function SimilarQuestions({
  question,
  basePath,
}: {
  question: Question;
  basePath: '/notes' | '/exams';
}) {
  // Remembered per question, so moving to another question folds the list again.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const topic = getLawQuestionFineTopic(question);
  const seed = useContext(SeedContext);
  const seeded = seed.some(([id]) => id === question.id);
  const loaded = useSimilarRows(seeded ? null : topic);
  if (!topic) return null;
  const rows = seeded ? seed : loaded.rows;
  const candidates = (rows ?? [])
    .filter(([id]) => id !== question.id)
    .flatMap(([id, text]) => {
      const parsed = parseQuestionId(id);
      return parsed ? [{ id, text, ...parsed }] : [];
    });
  const similar = { topic, questions: candidates, total: candidates.length };

  const expanded = expandedFor === question.id;
  const shown = expanded ? similar.questions : similar.questions.slice(0, PREVIEW_COUNT);

  return (
    <section className={styles.block} aria-label="類似題目">
      <h2 className={styles.heading}>類似考題</h2>
      {!rows ? (
        <>
          <p className={styles.lead} role="status">
            {loaded.status === 'error' ? '類似考題暫時無法載入。' : '正在載入類似考題…'}
          </p>
          {loaded.status === 'error' ? (
            <Button onClick={loaded.retry}>重新載入</Button>
          ) : null}
        </>
      ) : similar.total === 0 ? (
        <p className={styles.lead}>這個考點目前只有這一題。</p>
      ) : (
        <>
          <p className={styles.lead}>
            同考點「{similar.topic}」的其他考題，共 {similar.total} 題
          </p>
          <ol className={styles.rows}>
            {shown.map((candidate) => (
              <li key={candidate.id}>
                <Link href={`${basePath}?question=${candidate.id}`} prefetch={false}>
                  <span>
                    {candidate.year} 年・第 {candidate.questionNumber} 題
                  </span>
                  <strong>{candidate.text || '圖片題目'}</strong>
                </Link>
              </li>
            ))}
          </ol>
          {similar.total > PREVIEW_COUNT ? (
            <Button
              variant="ghost"
              className={styles.toggle}
              onClick={() => setExpandedFor(expanded ? null : question.id)}
            >
              {expanded
                ? `只顯示最近 ${PREVIEW_COUNT} 題`
                : `顯示全部 ${similar.total} 題`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
