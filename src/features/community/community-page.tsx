import { type FormEvent, useEffect, useState } from 'react';
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
  IconTrash,
} from '@tabler/icons-react';
import { AttachmentGallery } from '@/components/image-attachments';
import {
  EmptyState,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import { DifficultButton } from '@/components/difficult-button';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { RichText } from '@/components/rich-text';
import {
  QuestionNumberPicker,
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import {
  Button,
  ConfirmDialog,
  SimpleSelect,
  useToast,
} from '@/components/ui/ui';
import { getSubject, years } from '@/question-bank/catalog';
import type {
  DiscussionPost,
  DiscussionPostType,
  Question,
  SubjectId,
} from '@/lib/types';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { formatDateTime } from '@/lib/study';
import {
  useDiscussionQuestionIds,
  useSharedDiscussions,
} from '@/lib/shared-discussions';
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [pendingSubject, setPendingSubject] = useState<SubjectId | null>(null);
  const shared = useSharedDiscussions(currentQuestion?.id ?? 'unavailable');
  const discussionQuestionIds = useDiscussionQuestionIds();

  useEffect(() => {
    if (!pendingSubject) return;
    const first = questions
      .filter((question) => question.subject === pendingSubject)
      .sort(
        (left, right) =>
          right.year - left.year || left.questionNumber - right.questionNumber,
    )[0];
    if (!first) return;
    void router.replace(
      { pathname: '/community', query: { question: first.id } },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [pendingSubject, questions, router]);

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
  const posts = shared.posts;
  const difficultQuestionIds = new Set(state.difficultQuestionIds);
  const difficult = state.difficultQuestionIds.includes(currentQuestion.id);

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
    if (first) {
      setPendingSubject(null);
      navigateTo(first.id);
      return;
    }
    setPendingSubject(subjectId);
  }

  function selectYear(year: SelectorYear) {
    if (typeof year !== 'number') return;
    const first = questions.find(
      (question) =>
        question.subject === activeQuestion.subject && question.year === year,
    );
    if (first) navigateTo(first.id);
  }

  async function addPost(event: FormEvent) {
    event.preventDefault();
    const content = postContent.trim();
    if (!content) return;
    try {
      await shared.addPost(postType, content);
      setPostContent('');
      notify(
        '投稿完成',
        shared.enabled ? '所有使用者現在都能看到這則內容。' : '內容已保存在目前瀏覽器。',
      );
    } catch (reason) {
      notify('投稿失敗', reason instanceof Error ? reason.message : '請稍後再試。');
    }
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

  async function addReply(postId: string, event: FormEvent) {
    event.preventDefault();
    const content = replyDrafts[postId]?.trim();
    if (!content) return;
    try {
      await shared.addReply(postId, content);
      setReplyDrafts((current) => ({ ...current, [postId]: '' }));
    } catch (reason) {
      notify('回覆失敗', reason instanceof Error ? reason.message : '請稍後再試。');
    }
  }

  async function runPostAction(action: () => Promise<void>, title: string) {
    try {
      await action();
    } catch (reason) {
      notify(title, reason instanceof Error ? reason.message : '請稍後再試。');
    }
  }

  return (
    <div
      className={styles.interactionGuard}
      inert={!routeHydrated || !hydrated}
    >
      <QuestionSelector
        subjectId={pendingSubject ?? currentQuestion.subject}
        year={currentQuestion.year}
        yearOptions={years.map((year) => ({
          value: year,
          disabled: !availableYears.includes(year),
        }))}
        onSubjectChange={selectSubject}
        onYearChange={selectYear}
        ariaLabel="題目選擇"
      />

      <div className={styles.questionLayout}>
        <section className={styles.questionCard}>
          <header>
            <div className={styles.tags}>
              <Tag tone="green">{subject?.name}</Tag>
              <Tag>{currentQuestion.year} 年</Tag>
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
          <QuestionSourceLine question={currentQuestion} />
          <QuestionPrompt question={currentQuestion} />
          <QuestionAnswerPanel
            question={currentQuestion}
            heading={null}
            ariaLabel="題目選項"
          />
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

        <aside className={styles.questionNavigator} aria-label="詳解討論題號導覽">
          <header>
            <div>
              <span>QUESTION MAP</span>
              <h2>題號導覽</h2>
            </div>
            <strong>
              {paperQuestions.findIndex((item) => item.id === currentQuestion.id) + 1}/
              {paperQuestions.length}
            </strong>
          </header>
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
        </aside>
      </div>

      <div className={styles.discussionLayout}>
        <section className={styles.postsCard}>
          <header className={styles.sectionHeader}>
            <div>
              <span>DISCUSSION</span>
              <h2>共享內容</h2>
            </div>
            <strong>{posts.length} 則</strong>
          </header>
          {shared.error ? <p role="alert">{shared.error}</p> : null}
          {shared.loading ? <p role="status">正在載入共享投稿…</p> : null}
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
                  {post.content ? <p><RichText>{post.content}</RichText></p> : null}
                  <AttachmentGallery images={post.images} />
                  {post.replies.length ? (
                    <div className={styles.replies}>
                      {post.replies.map((reply) => (
                        <div key={reply.id}>
                          <span>匿名回覆・{formatDateTime(reply.createdAt)}</span>
                          <p><RichText>{reply.content}</RichText></p>
                          {shared.user && reply.authorId === shared.user.uid ? (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                void runPostAction(
                                  () => shared.deleteReply(post.id, reply.id),
                                  '刪除回覆失敗',
                                )
                              }
                            >
                              刪除回覆
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.postActions}>
                    <Button
                      variant="ghost"
                      aria-pressed={
                        shared.enabled
                          ? Boolean(post.likedByCurrentUser)
                          : state.likedDiscussionPostIds.includes(post.id)
                      }
                      onClick={() =>
                        void runPostAction(
                          () =>
                            shared.toggleLike(
                              post.id,
                              shared.enabled
                                ? Boolean(post.likedByCurrentUser)
                                : state.likedDiscussionPostIds.includes(post.id),
                            ),
                          '無法更新按讚',
                        )
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
                        void runPostAction(
                          () => shared.reportPost(post.id),
                          '無法送出檢舉',
                        )
                      }
                    >
                      {post.reported ? '已檢舉' : '檢舉'}
                    </Button>
                    {post.ownedByCurrentUser ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="danger">
                            <IconTrash size={16} stroke={2} aria-hidden="true" />
                            刪除
                          </Button>
                        }
                        title="刪除這則共享投稿？"
                        description="刪除後所有使用者都不會再看到這則內容。"
                        confirmLabel="確認刪除"
                        onConfirm={() =>
                          void runPostAction(
                            () => shared.deletePost(post.id),
                            '刪除失敗',
                          )
                        }
                      />
                    ) : null}
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
                        placeholder={
                          shared.enabled && !shared.user
                            ? '請先登入後再回覆'
                            : '輸入匿名回覆'
                        }
                        disabled={shared.enabled && !shared.user}
                      />
                      <Button
                        type="submit"
                        disabled={shared.enabled && !shared.user}
                      >
                        回覆
                      </Button>
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
          <span className={styles.composeEyebrow}>共享投稿</span>
          <h2>分享解題觀念</h2>
          {shared.enabled && !shared.user ? (
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => void shared.signIn()}
            >
              使用 Google 登入後投稿
            </Button>
          ) : null}
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
            disabled={shared.enabled && !shared.user}
          />
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={shared.enabled && !shared.user}
          >
            送出共享投稿
          </Button>
          <p>
            {shared.enabled
              ? '共享投稿會公開顯示給所有使用者，支援文字與最多 4 張圖片。'
              : 'Firebase 尚未設定，投稿內容僅儲存在這台裝置。'}
          </p>
        </form>
      </div>
    </div>
  );
}
