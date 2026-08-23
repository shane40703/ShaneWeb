import Link from 'next/link';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { getSimilarLawQuestions } from '@/lib/law-question-topics';
import type { Question } from '@/lib/types';
import styles from './similar-questions.module.css';

export function SimilarQuestions({
  question,
  questions,
  basePath,
}: {
  question: Question;
  questions: readonly Question[];
  basePath: '/notes' | '/community';
}) {
  const similar = getSimilarLawQuestions(question, questions);
  if (!similar.topic || !similar.questions.length) return null;

  return (
    <section className={styles.panel} aria-label="類似題目">
      <header>
        <IconArrowsShuffle size={18} stroke={2} aria-hidden="true" />
        <div><span>細分考點</span><strong>{similar.topic}</strong></div>
      </header>
      <div className={styles.links}>
        {similar.questions.map((candidate) => (
          <Link key={candidate.id} href={`${basePath}?question=${candidate.id}`}>
            <span>{candidate.year} 年・第 {candidate.questionNumber} 題</span>
            <strong>{candidate.text || '圖片題目'}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
