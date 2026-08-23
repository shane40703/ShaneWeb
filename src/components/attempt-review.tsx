import { useRef, useState } from 'react';
import {
  IconChevronDown,
  IconCircleCheck,
  IconMessages,
  IconMinus,
  IconNotebook,
  IconX,
} from '@tabler/icons-react';
import { QuestionPrompt } from '@/components/content/content';
import {
  appendImageFiles,
  ImageAttachments,
} from '@/components/image-attachments';
import { DifficultButton } from '@/components/difficult-button';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { AttachmentGallery } from '@/components/image-attachments';
import { RichText } from '@/components/rich-text';
import { TextFormattingToolbar } from '@/components/text-formatting-toolbar';
import { Button, useToast } from '@/components/ui/ui';
import {
  formatCorrectAnswer,
  isQuestionCorrect,
} from '@/lib/study';
import {
  useDiscussionPublisher,
  useSharedDiscussions,
} from '@/lib/shared-discussions';
import type { ImageAttachment, Question, QuizAttempt } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './attempt-review.module.css';

export type ReviewQuestion = Pick<
  Question,
  'id' | 'year' | 'questionNumber' | 'text' | 'options' | 'answerKey'
> &
  Partial<Pick<Question, 'content' | 'explanation'>>;

export function countWrongAttemptsThrough(
  currentAttempt: QuizAttempt,
  question: ReviewQuestion,
  attempts: readonly QuizAttempt[],
) {
  const candidates = attempts.some((candidate) => candidate.id === currentAttempt.id)
    ? attempts
    : [...attempts, currentAttempt];
  return candidates.filter((candidate) => {
    if (
      candidate.subject !== currentAttempt.subject ||
      candidate.year !== currentAttempt.year ||
      candidate.submittedAt > currentAttempt.submittedAt
    ) return false;
    const selected = candidate.answers[question.id];
    return selected !== undefined && !isQuestionCorrect(question, selected);
  }).length;
}

export function AttemptReview({
  attempt,
  questions,
  embedded = false,
  anchorPrefix,
  showDifficultActions = false,
}: {
  attempt: QuizAttempt;
  questions: readonly ReviewQuestion[];
  embedded?: boolean;
  anchorPrefix?: string;
  showDifficultActions?: boolean;
}) {
  const { state, dispatch } = useAppState();

  return (
    <section
      className={styles.reviewSection}
      data-embedded={embedded || undefined}
      aria-label="完整作答紀錄"
    >
      <header className={styles.reviewHeader}>
        <div>
          <span>完整對答案</span>
          <h2>逐題作答結果</h2>
        </div>
        <strong>共 {questions.length} 題</strong>
      </header>
      <div className={styles.reviewList}>
        {questions.map((question) => {
          const selected = attempt.answers[question.id];
          const selectedAnswer =
            selected === undefined
              ? '未作答'
              : String.fromCharCode(65 + selected);
          const questionCorrect = isQuestionCorrect(question, selected);
          const result =
            selected === undefined && question.answerKey.kind !== 'all-credit'
              ? 'unanswered'
              : questionCorrect
                ? 'correct'
                : 'wrong';
          const wrongAttemptCount = result === 'wrong'
            ? countWrongAttemptsThrough(attempt, question, state.attempts)
            : 0;
          return (
            <article
              key={question.id}
              id={anchorPrefix ? `${anchorPrefix}-${question.id}` : undefined}
              data-question-id={question.id}
              data-result={result}
            >
              <span
                className={styles.reviewStatus}
                aria-label={
                  result === 'correct'
                    ? '答對'
                    : result === 'wrong'
                      ? '答錯'
                      : '未作答'
                }
              >
                {result === 'correct' ? (
                  <IconCircleCheck size={19} stroke={2.2} aria-hidden="true" />
                ) : result === 'wrong' ? (
                  <IconX size={19} stroke={2.2} aria-hidden="true" />
                ) : (
                  <IconMinus size={19} stroke={2.2} aria-hidden="true" />
                )}
              </span>
              <div className={styles.reviewContent}>
                <div className={styles.reviewQuestionHeader}>
                  <span>
                    {question.year} 年・第 {question.questionNumber} 題
                  </span>
                  {wrongAttemptCount >= 2 ? (
                    <strong className={styles.repeatWrong}>已答錯 {wrongAttemptCount} 次</strong>
                  ) : null}
                  {showDifficultActions ? (
                    <DifficultButton
                      active={state.difficultQuestionIds.includes(question.id)}
                      onClick={() =>
                        dispatch({
                          type: 'toggle-difficult',
                          questionId: question.id,
                        })
                      }
                    />
                  ) : null}
                </div>
                {question.content ? (
                  <div className={styles.reviewPrompt}>
                    <QuestionPrompt
                      question={{ content: question.content }}
                      compact
                    />
                  </div>
                ) : (
                  <strong>{question.text || '圖片題目'}</strong>
                )}
                <p>
                  你的答案：{selectedAnswer}
                  <b>標準答案：{formatCorrectAnswer(question)}</b>
                </p>
              </div>
              <ReviewDiscussion question={question} />
              <details className={styles.reviewOptions}>
                <summary>
                  <span>檢視完整選項與筆記</span>
                  <IconChevronDown size={17} stroke={2} aria-hidden="true" />
                </summary>
                <QuestionAnswerPanel
                  question={question}
                  heading={null}
                  ariaLabel={`第 ${question.questionNumber} 題完整選項`}
                  selectedIndex={selected}
                  showStatusLabels
                />
                <ReviewNoteEditor question={question} />
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReviewDiscussion({ question }: { question: ReviewQuestion }) {
  const [open, setOpen] = useState(false);

  return (
    <section className={styles.reviewDiscussion}>
      <button type="button" onClick={() => setOpen((current) => !current)}>
        {open ? '收合詳解與討論' : '顯示詳解與討論'}
        <IconMessages size={15} stroke={2} aria-hidden="true" />
      </button>
      {open ? <ReviewDiscussionContent question={question} /> : null}
    </section>
  );
}

function ReviewDiscussionContent({ question }: { question: ReviewQuestion }) {
  const shared = useSharedDiscussions(question.id);
  const hasExplanation = Boolean(question.explanation?.trim());

  if (shared.loading) return <p>正在載入詳解與討論…</p>;
  if (shared.error) return <p>{shared.error}</p>;
  if (!hasExplanation && !shared.posts.length) {
    return <p>尚未有詳解或討論。</p>;
  }

  return (
    <div className={styles.reviewDiscussionContent}>
      {hasExplanation ? (
        <article>
          <strong>題目詳解</strong>
          <p><RichText>{question.explanation!}</RichText></p>
        </article>
      ) : null}
      {shared.posts.map((post) => (
        <article key={post.id}>
          {post.content ? <p><RichText>{post.content}</RichText></p> : null}
          <AttachmentGallery images={post.images} />
        </article>
      ))}
    </div>
  );
}

export function ReviewNoteEditor({ question }: { question: ReviewQuestion }) {
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const discussion = useDiscussionPublisher(question.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sharing, setSharing] = useState(false);
  const [content, setContent] = useState(state.notes[question.id] ?? '');
  const [images, setImages] = useState<ImageAttachment[]>(
    state.noteImages[question.id] ?? [],
  );

  function saveNote() {
    dispatch({
      type: 'save-note',
      questionId: question.id,
      content,
      images,
    });
    notify(content.trim() || images.length ? '筆記已儲存' : '筆記已刪除');
  }

  async function shareNote() {
    if (sharing) return;
    const trimmed = content.trim();
    if (!trimmed && !images.length) {
      notify('尚無可分享的筆記');
      return;
    }
    dispatch({
      type: 'save-note',
      questionId: question.id,
      content,
      images,
    });
    setSharing(true);
    try {
      const result = await discussion.publish('explanation', trimmed, images);
      notify(
        '筆記已分享至詳解與討論',
        discussion.enabled && images.length
          ? result.imagesShared
            ? '文字與圖片已同步共享。'
            : '文字已共享；圖片僅保存在本機筆記。'
          : undefined,
      );
    } catch (reason) {
      notify(
        '分享失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className={styles.reviewNote} aria-label={`第 ${question.questionNumber} 題使用者筆記`}>
      <header>
        <span>
          <IconNotebook size={16} stroke={2} aria-hidden="true" />
          使用者筆記
        </span>
        <small>登入後同步文字筆記・圖片保存在本機</small>
      </header>
      <TextFormattingToolbar
        textareaRef={textareaRef}
        value={content}
        onChange={setContent}
        ariaContext={`第 ${question.questionNumber} 題`}
      />
      <textarea
        ref={textareaRef}
        aria-label={`第 ${question.questionNumber} 題筆記內容`}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onPaste={(event) => {
          const files = [...event.clipboardData.files].filter((file) =>
            file.type.startsWith('image/'),
          );
          if (!files.length) return;
          event.preventDefault();
          void appendImageFiles(images, files).then((result) => {
            setImages(result.images);
            notify(
              result.images.length > images.length
                ? '已貼上筆記圖片'
                : '無法貼上圖片',
              result.error || undefined,
            );
          });
        }}
        rows={7}
        placeholder="在檢討答案時記下法條、公式或易錯觀念，也可以直接貼上截圖…"
      />
      <ImageAttachments
        images={images}
        onChange={setImages}
        label="上傳筆記圖片"
      />
      <footer>
        <Button disabled={sharing} onClick={() => void shareNote()}>
          <IconMessages size={16} stroke={2} aria-hidden="true" />
          {sharing ? '正在分享…' : '分享至詳解與討論'}
        </Button>
        <Button variant="primary" onClick={saveNote}>儲存筆記</Button>
      </footer>
    </section>
  );
}
