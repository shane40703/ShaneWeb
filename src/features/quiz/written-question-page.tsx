import Link from 'next/link';
import {
  IconArrowLeft,
  IconArrowRight,
  IconMessageCircle,
  IconNotes,
} from '@tabler/icons-react';
import {
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import {
  formatQuestionNumberLabel,
  getQuestionDisplayCategories,
} from '@/lib/study';
import type { Question, QuizQuestion } from '@/lib/types';
import styles from './quiz-page.module.css';

export function WrittenQuestionPage({
  question,
  paper,
}: {
  question: Question;
  paper: QuizQuestion[];
}) {
  const subject = getSubject(question.subject);
  const position = paper.findIndex((item) => item.id === question.id);
  const previous = paper[position - 1];
  const next = paper[position + 1];
  const hasImage = question.content.some((block) => block.kind === 'image');

  return (
    <div className={styles.quizLayout}>
      <section className={styles.card}>
        <header className={styles.quizHeader}>
          <div className={styles.meta}>
            <Tag tone="green">{subject?.shortName}</Tag>
            <Tag>{question.year} 年</Tag>
            <Tag tone="purple">申論題</Tag>
            {getQuestionDisplayCategories(question).map((category) => (
              <Tag tone="orange" key={category}>{category}</Tag>
            ))}
          </div>
        </header>

        <div
          className={styles.questionBody}
          data-has-image={hasImage || undefined}
        >
          <div className={styles.questionContentColumn}>
            <QuestionSourceLine question={question} />
            <span className={styles.questionNumber}>
              {formatQuestionNumberLabel(question)}・{position + 1}/{paper.length}
            </span>
            <QuestionPrompt question={question} />
          </div>
          <div className={styles.answerColumn}>
            <section className={styles.writtenNotice}>
              <strong>本題僅供檢視</strong>
              <p>申論題不納入線上選擇、計分與錯題統計；可前往筆記或詳解討論撰寫解題內容。</p>
            </section>
            <div className={styles.writtenActions}>
              <Button
                variant="primary"
                render={<Link href={`/notes?question=${question.id}`} />}
              >
                <IconNotes size={17} stroke={2} aria-hidden="true" />
                寫使用者筆記
              </Button>
              <Button
                render={<Link href={`/community?question=${question.id}`} />}
              >
                <IconMessageCircle size={17} stroke={2} aria-hidden="true" />
                詳解與討論
              </Button>
            </div>
          </div>
        </div>

        <footer className={styles.navigation}>
          <span className={styles.writtenSectionLabel}>申論題導覽</span>
          <div className={styles.navigationButtons}>
            {previous ? (
              <Button render={<Link href={previous.path} />}>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            ) : (
              <Button disabled>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            )}
            {next ? (
              <Button variant="primary" render={<Link href={next.path} />}>
                下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" render={<Link href="/papers" />}>
                返回歷屆試題
              </Button>
            )}
          </div>
        </footer>
      </section>

      <aside className={styles.questionNavigator} aria-label="申論題題號導覽">
        <header>
          <div>
            <span>WRITTEN</span>
            <h2>申論題導覽</h2>
          </div>
          <strong>{position + 1}/{paper.length}</strong>
        </header>
        <div className={styles.questionNumbers}>
          <QuestionNumberGrid>
            {paper.map((item, index) => (
              <QuestionNumberButton
                key={item.id}
                href={item.path}
                ariaLabel={`前往申論第 ${item.questionNumber} 題`}
                active={index === position}
              >
                申{item.questionNumber}
              </QuestionNumberButton>
            ))}
          </QuestionNumberGrid>
        </div>
      </aside>
    </div>
  );
}
