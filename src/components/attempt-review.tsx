import Link from 'next/link';
import { useState } from 'react';
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
import { Button, useToast } from '@/components/ui/ui';
import {
  formatCorrectAnswer,
  isQuestionCorrect,
} from '@/lib/study';
import { useDiscussionPublisher } from '@/lib/shared-discussions';
import type { ImageAttachment, Question, QuizAttempt } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './attempt-review.module.css';

type ReviewQuestion = Pick<
  Question,
  'id' | 'year' | 'questionNumber' | 'text' | 'options' | 'answerKey'
> &
  Partial<Pick<Question, 'content' | 'explanation'>>;

function explanationText(question: ReviewQuestion) {
  if (question.explanation) return question.explanation;
  if (question.answerKey.kind === 'all-credit') return '本題一律給分。';
  return '目前尚無詳解。';
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
        {questions.map((question, index) => {
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
          return (
            <article
              key={question.id}
              id={anchorPrefix ? `${anchorPrefix}-${question.id}` : undefined}
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
                    {index + 1}. {question.year} 年・第 {question.questionNumber} 題
                  </span>
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
              <div className={styles.bestAnswer}>
                <header>
                  <span>詳解</span>
                  <Link href={`/community?question=${question.id}`}>
                    詳解與討論
                    <IconMessages size={15} stroke={2} aria-hidden="true" />
                  </Link>
                </header>
                <p>{explanationText(question)}</p>
              </div>
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

function ReviewNoteEditor({ question }: { question: ReviewQuestion }) {
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const discussion = useDiscussionPublisher(question.id);
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
    try {
      await discussion.publish('explanation', trimmed, images);
      notify(
        '筆記已分享至詳解與討論',
        discussion.enabled && images.length
          ? '文字已共享；筆記圖片目前僅保存在自己的裝置。'
          : undefined,
      );
    } catch (reason) {
      notify(
        '分享失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
      );
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
      <textarea
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
        rows={3}
        placeholder="在檢討答案時記下法條、公式或易錯觀念，也可以直接貼上截圖…"
      />
      <ImageAttachments
        images={images}
        onChange={setImages}
        label="上傳筆記圖片"
      />
      <footer>
        <Button onClick={() => void shareNote()}>
          <IconMessages size={16} stroke={2} aria-hidden="true" />
          分享至詳解與討論
        </Button>
        <Button variant="primary" onClick={saveNote}>儲存筆記</Button>
      </footer>
    </section>
  );
}
