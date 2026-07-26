import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IconArrowLeft,
  IconArrowRight,
  IconAlertCircle,
  IconHeart,
  IconHelpCircle,
  IconLoader2,
  IconMessageCircle,
  IconNotebook,
} from '@tabler/icons-react';
import { AttachmentGallery, ImageAttachments } from '@/components/image-attachments';
import {
  DifficultButton,
  EmptyState,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import {
  QuestionNumberPicker,
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { Button, SimpleSelect, useToast } from '@/components/ui/ui';
import { getSubject, years } from '@/question-bank/catalog';
import type {
  DiscussionPost,
  DiscussionPostType,
  ImageAttachment,
  Question,
  SubjectId,
} from '@/lib/types';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { questionPath } from '@/lib/question-path';
import { formatDateTime, getAcceptedAnswerIndexes } from '@/lib/study';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import styles from './community-page.module.css';

const postTypeLabels: Record<DiscussionPostType, string> = {
  explanation: '題目詳解',
  supplement: '觀念補充',
  question: '提問',
  correction: '答案勘誤',
};

const postTypeOptions = Object.entries(postTypeLabels).map(([value, label]) => ({
  value: value as DiscussionPostType,
  label,
}));

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function CommunityPage({
  questions,
  questionBankStatus = 'ready',
  onRetryQuestionBank,
}: {
  questions: Question[];
  questionBankStatus?: QuestionBankStatus;
  onRetryQuestionBank?: () => void;
}) {
  const router = useRouter();
  const { state, dispatch, hydrated } = useAppState();
  const { notify } = useToast();
  const routeHydrated = useClientReady();
  const requestedQuestionId =
    routeHydrated && router.isReady !== false
      ? valueOf(router.query.question)
      : undefined;
  const requestedQuestion = requestedQuestionId
    ? questions.find((question) => question.id === requestedQuestionId)
    : undefined;
  const currentQuestion = requestedQuestionId
    ? requestedQuestion
    : questions[0];
  const [postType, setPostType] = useState<DiscussionPostType>('explanation');
  const [postContent, setPostContent] = useState('');
  const [postImages, setPostImages] = useState<ImageAttachment[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  if (
    routeHydrated &&
    (router.isReady === false ||
      (!currentQuestion && questionBankStatus === 'loading'))
  ) {
    return (
      <EmptyState
        icon={IconLoader2}
        title="正在載入題目"
        description="正在取得指定題目的詳解與討論，請稍候。"
      />
    );
  }

  if (questionBankStatus === 'error') {
    return (
      <EmptyState
        icon={IconAlertCircle}
        title="題庫載入失敗"
        description="目前無法取得完整題庫，請重新載入後再試。"
        action={
          onRetryQuestionBank ? (
            <Button onClick={onRetryQuestionBank}>重新載入</Button>
          ) : undefined
        }
      />
    );
  }

  if (!currentQuestion) {
    return (
      <EmptyState
        icon={IconHelpCircle}
        title={requestedQuestionId ? '找不到指定題目' : '題庫尚無資料'}
        description={
          requestedQuestionId
            ? '這個題目可能已移除，請從題庫重新選擇。'
            : '加入題目後即可使用詳解與討論。'
        }
      />
    );
  }

  const activeQuestion = currentQuestion;
  const subject = getSubject(currentQuestion.subject);
  const subjectQuestions = questions
    .filter((question) => question.subject === currentQuestion.subject)
    .sort(
      (left, right) =>
        right.year - left.year || left.questionNumber - right.questionNumber,
    );
  const availableYears = [
    ...new Set(subjectQuestions.map((question) => question.year)),
  ].sort((a, b) => b - a);
  const paperQuestions = questions
    .filter(
      (question) =>
        question.subject === currentQuestion.subject &&
        question.year === currentQuestion.year,
    )
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const currentIndex = subjectQuestions.findIndex(
    (question) => question.id === currentQuestion.id,
  );
  const posts = state.discussionPosts.filter(
    (post) => post.questionId === currentQuestion.id,
  );
  const discussionQuestionIds = new Set(
    state.discussionPosts.map((post) => post.questionId),
  );
  const difficultQuestionIds = new Set(state.difficultQuestionIds);
  const difficult = state.difficultQuestionIds.includes(currentQuestion.id);
  const acceptedAnswers = getAcceptedAnswerIndexes(currentQuestion);

  function navigateTo(questionId: string) {
    void router.replace(
      { pathname: '/community', query: { question: questionId } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function selectSubject(subjectId: SubjectId) {
    const first = questions
      .filter((question) => question.subject === subjectId)
      .sort(
        (left, right) =>
          right.year - left.year || left.questionNumber - right.questionNumber,
      )[0];
    if (first) navigateTo(first.id);
  }

  function selectYear(year: SelectorYear) {
    if (typeof year !== 'number') return;
    const first = questions.find(
      (question) =>
        question.subject === activeQuestion.subject && question.year === year,
    );
    if (first) navigateTo(first.id);
  }

  function addPost(event: FormEvent) {
    event.preventDefault();
    const content = postContent.trim();
    if (!content && !postImages.length) return;
    const now = new Date().toISOString();
    dispatch({
      type: 'add-discussion-post',
      post: {
        id: `post-${now}`,
        questionId: activeQuestion.id,
        type: postType,
        content,
        images: postImages,
        createdAt: now,
        likes: 0,
        replies: [],
        reported: false,
      },
    });
    setPostContent('');
    setPostImages([]);
    notify('已匿名投稿', '內容已保存在目前瀏覽器。');
  }

  function savePostToNote(post: DiscussionPost) {
    const currentContent = state.notes[activeQuestion.id] ?? '';
    const importedContent = post.content.trim();
    const content = [currentContent, importedContent].filter(Boolean).join('\n\n');
    const existingImages = state.noteImages[activeQuestion.id] ?? [];
    const imageIds = new Set(existingImages.map((image) => image.id));
    const images = [
      ...existingImages,
      ...post.images.filter((image) => !imageIds.has(image.id)),
    ];
    dispatch({
      type: 'save-note',
      questionId: activeQuestion.id,
      content,
      images,
    });
    notify('已加入我的筆記', '文字與圖片已保存到這一題。');
  }

  function addReply(postId: string, event: FormEvent) {
    event.preventDefault();
    const content = replyDrafts[postId]?.trim();
    if (!content) return;
    dispatch({
      type: 'add-discussion-reply',
      postId,
      reply: {
        id: `reply-${postId}-${new Date().toISOString()}`,
        content,
        createdAt: new Date().toISOString(),
      },
    });
    setReplyDrafts((current) => ({ ...current, [postId]: '' }));
  }

  return (
    <div
      className={styles.interactionGuard}
      inert={!routeHydrated || !hydrated}
    >
      <QuestionSelector
        subjectId={currentQuestion.subject}
        year={currentQuestion.year}
        yearOptions={years.map((year) => ({
          value: year,
          disabled: !availableYears.includes(year),
        }))}
        onSubjectChange={selectSubject}
        onYearChange={selectYear}
        ariaLabel="題目選擇"
        questionPicker={
          <QuestionNumberPicker
            questions={paperQuestions.map((question) => ({
              id: question.id,
              questionNumber: question.questionNumber,
              difficult: difficultQuestionIds.has(question.id),
              hasContent:
                Boolean(question.explanation?.trim()) ||
                discussionQuestionIds.has(question.id),
            }))}
            value={currentQuestion.id}
            onValueChange={navigateTo}
            showStatusLegend
          />
        }
        summary={
          <>
            已選{' '}
            <strong>
              {subject?.name} · {currentQuestion.year} 年 · 第{' '}
              {currentQuestion.questionNumber} 題
            </strong>
          </>
        }
        action={<span className={styles.selectorHint}>詳解顯示於下方</span>}
      />

      <section className={styles.questionCard}>
        <header>
          <div className={styles.tags}>
            <Tag tone="green">{subject?.name}</Tag>
            <Tag>{currentQuestion.year} 年</Tag>
            <Tag tone="purple">第 {currentQuestion.questionNumber} 題</Tag>
            {currentQuestion.source.kind === 'sample' ? (
              <Tag tone="purple">示範題</Tag>
            ) : null}
          </div>
          <DifficultButton
            active={difficult}
            onClick={() =>
              dispatch({ type: 'toggle-difficult', questionId: currentQuestion.id })
            }
          />
        </header>
        <QuestionPrompt question={currentQuestion} />
        <QuestionSourceLine question={currentQuestion} />
        <ol className={styles.options}>
          {currentQuestion.options.map((option, index) => {
            const correct = acceptedAnswers.includes(index);
            const optionLabel = String.fromCharCode(65 + index);
            return (
              <li
                key={index}
                data-correct={correct}
                aria-label={correct ? `正確選項 ${optionLabel}：${option}` : undefined}
              >
                <span>{optionLabel}</span>
                {option}
              </li>
            );
          })}
        </ol>
        <section className={styles.explanation} aria-label="題目詳解">
          <span>詳解</span>
          <p>{currentQuestion.explanation ?? '目前尚無詳解。'}</p>
        </section>
        <footer className={styles.questionNavigation}>
          <Button
            disabled={currentIndex <= 0}
            onClick={() =>
              subjectQuestions[currentIndex - 1] &&
              navigateTo(subjectQuestions[currentIndex - 1].id)
            }
          >
            <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
          </Button>
          <Button
            variant="ghost"
            render={
              <Link
                href={questionPath(
                  currentQuestion.subject,
                  currentQuestion.year,
                  currentQuestion.questionNumber,
                )}
              />
            }
          >
            返回作答頁
          </Button>
          <Button
            disabled={currentIndex >= subjectQuestions.length - 1}
            onClick={() =>
              subjectQuestions[currentIndex + 1] &&
              navigateTo(subjectQuestions[currentIndex + 1].id)
            }
          >
            下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
          </Button>
        </footer>
      </section>

      <div className={styles.discussionLayout}>
        <section className={styles.postsCard}>
          <header className={styles.sectionHeader}>
            <div>
              <span>DISCUSSION</span>
              <h2>匿名內容</h2>
            </div>
            <strong>{posts.length} 則</strong>
          </header>
          {posts.length ? (
            <div className={styles.postList}>
              {posts.map((post) => (
                <article className={styles.post} key={post.id}>
                  <header>
                    <Tag tone={post.type === 'correction' ? 'orange' : 'purple'}>
                      {postTypeLabels[post.type]}
                    </Tag>
                    <time dateTime={post.createdAt}>
                      {formatDateTime(post.createdAt)}
                    </time>
                  </header>
                  {post.content ? <p>{post.content}</p> : null}
                  <AttachmentGallery images={post.images} />
                  {post.replies.length ? (
                    <div className={styles.replies}>
                      {post.replies.map((reply) => (
                        <div key={reply.id}>
                          <span>匿名回覆・{formatDateTime(reply.createdAt)}</span>
                          <p>{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.postActions}>
                    <Button
                      variant="ghost"
                      aria-pressed={state.likedDiscussionPostIds.includes(post.id)}
                      onClick={() =>
                        dispatch({ type: 'like-discussion-post', postId: post.id })
                      }
                    >
                      <IconHeart size={17} stroke={2} aria-hidden="true" /> 讚{' '}
                      {post.likes}
                    </Button>
                    <Button variant="ghost" onClick={() => savePostToNote(post)}>
                      <IconNotebook size={17} stroke={2} aria-hidden="true" />
                      加入我的筆記
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={post.reported}
                      onClick={() =>
                        dispatch({ type: 'report-discussion-post', postId: post.id })
                      }
                    >
                      {post.reported ? '已檢舉' : '檢舉'}
                    </Button>
                  </div>
                  <form
                    className={styles.replyForm}
                    onSubmit={(event) => addReply(post.id, event)}
                  >
                    <label htmlFor={`reply-${post.id}`}>回覆這則內容</label>
                    <div>
                      <input
                        id={`reply-${post.id}`}
                        value={replyDrafts[post.id] ?? ''}
                        onChange={(event) =>
                          setReplyDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder="輸入匿名回覆"
                      />
                      <Button type="submit">回覆</Button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IconMessageCircle}
              title="還沒有內容"
              description="成為第一個留下詳解或提問的人。"
            />
          )}
        </section>

        <form className={styles.composeCard} onSubmit={addPost}>
          <span className={styles.composeEyebrow}>匿名投稿</span>
          <h2>分享解題觀念</h2>
          <SimpleSelect
            label="投稿類型"
            value={postType}
            options={postTypeOptions}
            onValueChange={setPostType}
          />
          <label htmlFor="post-content">內容</label>
          <textarea
            id="post-content"
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
            rows={8}
            placeholder="請清楚描述你的詳解、補充、提問或勘誤…"
          />
          <ImageAttachments
            images={postImages}
            onChange={setPostImages}
            label="上傳詳解圖片"
          />
          <Button type="submit" variant="primary" fullWidth>
            匿名送出
          </Button>
          <p>目前沒有帳號系統，投稿內容僅儲存在這台裝置，不會同步給其他使用者。</p>
        </form>
      </div>
    </div>
  );
}
