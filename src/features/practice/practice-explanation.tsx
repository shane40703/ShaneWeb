import { AttachmentGallery } from '@/components/image-attachments';
import { RichText } from '@/components/rich-text';
import { formatCorrectAnswer } from '@/lib/study';
import { useSharedDiscussions } from '@/lib/shared-discussions';
import type { Question } from '@/lib/types';
import styles from './practice-page.module.css';

/** The built-in explanation plus the community posts that explain the answer. */
export function PracticeExplanation({
  question,
  selectedIndex,
  showAnswers = true,
}: {
  question: Question;
  selectedIndex: number;
  /** Off where a result banner above already states both answers. */
  showAnswers?: boolean;
}) {
  const shared = useSharedDiscussions(question.id);
  const usefulPosts = shared.posts.filter((post) =>
    ['explanation', 'supplement', 'correction'].includes(post.type),
  );
  const hasBuiltInExplanation = Boolean(question.explanation?.trim());

  return (
    <section
      className={styles.explanation}
      aria-label={`原題第 ${question.questionNumber} 題詳解`}
    >
      <strong>
        {showAnswers ? `正確答案：${formatCorrectAnswer(question)}` : '詳解'}
      </strong>
      {hasBuiltInExplanation ? (
        <p>
          <RichText>{question.explanation!}</RichText>
        </p>
      ) : null}
      {usefulPosts.map((post) => (
        <article key={post.id}>
          {post.content ? (
            <p>
              <RichText>{post.content}</RichText>
            </p>
          ) : null}
          <AttachmentGallery images={post.images} />
        </article>
      ))}
      {shared.loading ? <p>正在載入詳解與討論…</p> : null}
      {!shared.loading && !hasBuiltInExplanation && !usefulPosts.length ? (
        <p>{shared.error || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
      ) : null}
      {showAnswers ? (
        <span className={styles.answerSummary}>
          你的答案：{String.fromCharCode(65 + selectedIndex)}
        </span>
      ) : null}
    </section>
  );
}
