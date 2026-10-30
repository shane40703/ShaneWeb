import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconHeart,
  IconHeartFilled,
  IconNotebook,
  IconPencil,
  IconTrash,
  IconX,
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
import {
  QuestionNoteEditor,
  type QuestionNoteDraft,
} from '@/components/question-note-editor';
import { RichText } from '@/components/rich-text';
import { hasSimilarQuestionsBlock, SimilarQuestions } from '@/components/similar-questions';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Tab, TabList, TabPanel, TabsRoot } from '@/components/tabs';
import { mergeRichTextValues } from '@/lib/rich-document';
import {
  QuestionNumberPicker,
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import {
  Button,
  ConfirmDialog,
  OptionGroup,
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
import {
  comparePaperQuestionOrder,
  formatCorrectAnswer,
  formatDateTime,
  formatQuestionNumberLabel,
  getQuestionDisplayCategories,
  isQuestionCorrect,
} from '@/lib/study';
import { useDiscussionQuestionIds, useSharedDiscussions } from '@/lib/shared-discussions';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import styles from './exams-page.module.css';

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

/** Posts that count as the answer's explanation on the 題目 tab (not 提問). */
const explanationPostTypes: readonly DiscussionPostType[] = [
  'explanation',
  'supplement',
  'correction',
];

type ExamsTab = 'question' | 'discussion' | 'notes';

/** Answer-then-reveal state of one question; never written to app state. */
interface PracticeState {
  selected?: number;
  revealed: boolean;
}

/** A tab click, remembered until the URL (the source of truth) catches up with it. */
interface TabOverride {
  tab: ExamsTab;
  /** The URL's tab when the click happened. */
  queryTab: ExamsTab | undefined;
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** `?tab=discussion|notes`; absent or anything else is the 題目 tab. */
function tabOf(value: string | string[] | undefined): ExamsTab {
  const tab = valueOf(value);
  return tab === 'discussion' || tab === 'notes' ? tab : 'question';
}

/** The 題目 tab keeps the URL as before (`?question=` only). */
function queryFor(questionId: string, tab: ExamsTab) {
  return tab === 'question' ? { question: questionId } : { question: questionId, tab };
}

export function ExamsPage({
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
  const routeReady = routeHydrated && router.isReady !== false;
  const requestedQuestionId = routeReady ? valueOf(router.query.question) : undefined;
  const queryTab = routeReady ? tabOf(router.query.tab) : undefined;
  const requestedQuestion = requestedQuestionId
    ? questions.find((question) => question.id === requestedQuestionId)
    : undefined;
  const currentQuestion = requestedQuestionId ? requestedQuestion : questions[0];
  const currentQuestionId = currentQuestion?.id;
  // The tab comes from the URL (so a shared link or back/forward lands on the right tab);
  // a click switches the panel at once and is remembered only until router.replace has
  // updated the query, after which the URL alone decides again.
  const [tabOverride, setTabOverride] = useState<TabOverride | null>(null);
  if (tabOverride && tabOverride.queryTab !== queryTab) setTabOverride(null);
  const tab = tabOverride?.tab ?? queryTab ?? 'question';
  const [practice, setPractice] = useState<Record<string, PracticeState>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, QuestionNoteDraft>>({});
  const [postType, setPostType] = useState<DiscussionPostType>('explanation');
  const [postContent, setPostContent] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [pendingSubject, setPendingSubject] = useState<SubjectId | null>(null);
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const focusVerdictFor = useRef<string | null>(null);
  const shared = useSharedDiscussions(currentQuestion?.id ?? 'unavailable');
  const discussionQuestionIds = useDiscussionQuestionIds();
  const currentPractice = currentQuestionId ? practice[currentQuestionId] : undefined;
  const revealed = currentPractice?.revealed ?? false;

  useEffect(() => {
    if (!pendingSubject) return;
    const first = questions
      .filter((question) => question.subject === pendingSubject)
      .sort(
        (left, right) => right.year - left.year || comparePaperQuestionOrder(left, right),
      )[0];
    if (!first) return;
    void router.replace(
      { pathname: '/exams', query: queryFor(first.id, tab) },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [pendingSubject, questions, router, tab]);

  // 看解答 disappears with the reveal, so focus moves to the verdict line.
  useEffect(() => {
    if (!revealed || focusVerdictFor.current !== currentQuestionId) return;
    focusVerdictFor.current = null;
    verdictRef.current?.focus();
  }, [revealed, currentQuestionId]);

  if (
    routeHydrated &&
    (router.isReady === false || (!currentQuestion && questionBankStatus === 'loading'))
  ) {
    return (
      <EmptyState
        title="正在載入題目"
        description="正在取得指定題目的詳解與討論，請稍候。"
      />
    );
  }

  if (questionBankStatus === 'error' && !currentQuestion) {
    return (
      <EmptyState
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
      (left, right) => right.year - left.year || comparePaperQuestionOrder(left, right),
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
    .sort(comparePaperQuestionOrder);
  const currentIndex = subjectQuestions.findIndex(
    (question) => question.id === currentQuestion.id,
  );
  const posts = shared.posts;
  const difficultQuestionIds = new Set(state.difficultQuestionIds);
  const difficult = state.difficultQuestionIds.includes(currentQuestion.id);
  const written = currentQuestion.format === 'written';
  const selected = currentPractice?.selected;
  const correct = isQuestionCorrect(currentQuestion, selected);
  const builtInExplanation = currentQuestion.explanation?.trim()
    ? currentQuestion.explanation
    : undefined;
  const explanationPosts = posts.filter((post) =>
    explanationPostTypes.includes(post.type),
  );
  const hasExplanation = Boolean(builtInExplanation) || explanationPosts.length > 0;

  function navigateTo(questionId: string) {
    void router.replace(
      { pathname: '/exams', query: queryFor(questionId, tab) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function setTab(nextTab: ExamsTab) {
    setTabOverride({ tab: nextTab, queryTab });
    void router.replace(
      { pathname: '/exams', query: queryFor(activeQuestion.id, nextTab) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function selectSubject(subjectId: SubjectId) {
    const first = questions
      .filter((question) => question.subject === subjectId)
      .sort(
        (left, right) => right.year - left.year || comparePaperQuestionOrder(left, right),
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
      (question) => question.subject === activeQuestion.subject && question.year === year,
    );
    if (first) navigateTo(first.id);
  }

  function selectOption(value: number | undefined) {
    setPractice((current) => ({
      ...current,
      [activeQuestion.id]: { selected: value, revealed: false },
    }));
  }

  function reveal() {
    focusVerdictFor.current = activeQuestion.id;
    setPractice((current) => ({
      ...current,
      [activeQuestion.id]: {
        selected: current[activeQuestion.id]?.selected,
        revealed: true,
      },
    }));
  }

  function reset() {
    setPractice((current) => ({
      ...current,
      [activeQuestion.id]: { revealed: false },
    }));
  }

  async function addPost(event: FormEvent) {
    event.preventDefault();
    const content = postContent;
    if (!content.trim()) return;
    try {
      await shared.addPost(postType, content);
      setPostContent('');
      notify(
        '投稿完成',
        shared.enabled ? '所有使用者現在都能看到這則內容。' : '內容已保存在目前瀏覽器。',
      );
    } catch (reason) {
      notify(
        '投稿失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
        'error',
      );
    }
  }

  // Merges into the unsaved 筆記 draft when there is one, so nothing typed there is lost;
  // the draft is then dropped because its content is saved.
  function savePostToNote(post: DiscussionPost) {
    const draft = noteDrafts[activeQuestion.id];
    const currentContent = draft?.content ?? state.notes[activeQuestion.id] ?? '';
    const importedContent = post.content;
    const content = mergeRichTextValues(currentContent, importedContent);
    const existingImages = draft?.images ?? state.noteImages[activeQuestion.id] ?? [];
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
    setNoteDrafts((current) => {
      const next = { ...current };
      delete next[activeQuestion.id];
      return next;
    });
    notify('已加入我的筆記', '文字與圖片已保存到這一題。');
  }

  async function addReply(postId: string, event: FormEvent) {
    event.preventDefault();
    const content = replyDrafts[postId] ?? '';
    if (!content.trim()) return;
    try {
      await shared.addReply(postId, content);
      setReplyDrafts((current) => ({ ...current, [postId]: '' }));
    } catch (reason) {
      notify(
        '回覆失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
        'error',
      );
    }
  }

  async function runPostAction(action: () => Promise<void>, title: string) {
    try {
      await action();
      return true;
    } catch (reason) {
      notify(title, reason instanceof Error ? reason.message : '請稍後再試。', 'error');
      return false;
    }
  }

  async function reportPost(postId: string) {
    if (await runPostAction(() => shared.reportPost(postId), '無法送出檢舉')) {
      notify('已送出檢舉', undefined, 'info');
    }
  }

  function isLiked(post: { id: string; likedByCurrentUser?: boolean }) {
    return shared.enabled
      ? Boolean(post.likedByCurrentUser)
      : state.likedDiscussionPostIds.includes(post.id);
  }

  async function saveEditedPost(postId: string) {
    try {
      await shared.editPost(postId, editingContent);
      setEditingPostId(null);
      setEditingContent('');
      notify('投稿已更新');
    } catch (reason) {
      notify(
        '編輯失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
        'error',
      );
    }
  }

  return (
    <div className={styles.page} inert={!routeHydrated || !hydrated}>
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

      <div className={styles.examsLayout}>
        <main className={styles.contentColumn}>
          <TabsRoot value={tab} onValueChange={setTab} ariaLabel="題目分頁">
            <TabList>
              <Tab value="question">題目</Tab>
              <Tab value="discussion" badge={posts.length > 0 ? posts.length : undefined}>
                討論區
              </Tab>
              <Tab value="notes">筆記</Tab>
            </TabList>

            <TabPanel value="question" className={styles.tabPanel}>
              <section className={styles.questionCard}>
                <header>
                  <div className={styles.tags}>
                    <Tag tone="green">{subject?.name}</Tag>
                    <Tag>{currentQuestion.year} 年</Tag>
                    {getQuestionDisplayCategories(currentQuestion).map((category) => (
                      <Tag tone="orange" key={category}>
                        {category}
                      </Tag>
                    ))}
                    {written ? <Tag tone="purple">申論題</Tag> : null}
                    {currentQuestion.source.kind === 'sample' ? (
                      <Tag tone="purple">示範題</Tag>
                    ) : null}
                  </div>
                  {!written ? (
                    <DifficultButton
                      active={difficult}
                      onClick={() =>
                        dispatch({
                          type: 'toggle-difficult',
                          questionId: currentQuestion.id,
                        })
                      }
                    />
                  ) : null}
                </header>
                <QuestionSourceLine question={currentQuestion} />
                <h2 className={styles.questionNumber}>
                  {formatQuestionNumberLabel(currentQuestion)}
                </h2>
                <QuestionPrompt question={currentQuestion} />
                <div className={styles.practice}>
                  {written ? null : revealed ? (
                    <>
                      <QuestionAnswerPanel
                        question={currentQuestion}
                        heading={null}
                        ariaLabel="題目選項"
                        selectedIndex={selected}
                        showStatusLabels={selected !== undefined}
                      />
                      <p
                        ref={verdictRef}
                        role="status"
                        tabIndex={-1}
                        className={styles.verdict}
                        data-correct={(selected !== undefined && correct) || undefined}
                        data-unanswered={selected === undefined || undefined}
                      >
                        {selected !== undefined ? (
                          correct ? (
                            <IconCircleCheck size={18} stroke={2} aria-hidden="true" />
                          ) : (
                            <IconX size={18} stroke={2} aria-hidden="true" />
                          )
                        ) : null}
                        {selected !== undefined ? (
                          <strong>{correct ? '答對了' : '答錯了'}</strong>
                        ) : null}
                        <span>
                          正確答案：{formatCorrectAnswer(currentQuestion)}
                          {selected !== undefined
                            ? `・你的答案：${String.fromCharCode(65 + selected)}`
                            : null}
                        </span>
                      </p>
                    </>
                  ) : (
                    <div className={styles.answerArea}>
                      <OptionGroup
                        label="題目選項"
                        options={currentQuestion.options}
                        value={selected}
                        onValueChange={selectOption}
                      />
                    </div>
                  )}
                  <div className={styles.answerActions}>
                    {revealed ? (
                      <Button variant="ghost" onClick={reset}>
                        {written ? '收起解答' : '重新作答'}
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={reveal}>
                        看解答
                      </Button>
                    )}
                  </div>
                  {revealed ? (
                    <div className={styles.explanation}>
                      <h3>詳解</h3>
                      {builtInExplanation ? (
                        <p>
                          <RichText>{builtInExplanation}</RichText>
                        </p>
                      ) : null}
                      {explanationPosts.map((post) => (
                        <article key={post.id}>
                          <Tag tone={post.type === 'correction' ? 'orange' : 'purple'}>
                            {postTypeLabels[post.type]}
                          </Tag>
                          {post.content ? (
                            <p>
                              <RichText>{post.content}</RichText>
                            </p>
                          ) : null}
                          <AttachmentGallery images={post.images} />
                        </article>
                      ))}
                      {!hasExplanation && shared.loading ? (
                        <p className={styles.explanationEmpty} role="status">
                          正在載入詳解…
                        </p>
                      ) : null}
                      {!hasExplanation && !shared.loading ? (
                        <>
                          <p className={styles.explanationEmpty}>目前尚無詳解。</p>
                          <div className={styles.answerActions}>
                            <Button variant="ghost" onClick={() => setTab('discussion')}>
                              到討論區看看
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
              {hasSimilarQuestionsBlock(currentQuestion) ? (
                <section className={styles.similarCard}>
                  <SimilarQuestions
                    question={currentQuestion}
                    questions={questions}
                    basePath="/exams"
                  />
                </section>
              ) : null}
            </TabPanel>

            <TabPanel value="discussion" className={styles.tabPanel}>
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
                        {editingPostId === post.id ? (
                          <div className={styles.editPost}>
                            <RichTextEditor
                              value={editingContent}
                              onChange={setEditingContent}
                              ariaContext="編輯投稿"
                              ariaLabel="編輯投稿內容"
                              maxLength={5000}
                            />
                            <div className={styles.editActions}>
                              <Button onClick={() => void saveEditedPost(post.id)}>
                                儲存修改
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setEditingPostId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : post.content ? (
                          <p>
                            <RichText>{post.content}</RichText>
                          </p>
                        ) : null}
                        <AttachmentGallery images={post.images} />
                        {post.replies.length ? (
                          <div className={styles.replies}>
                            {post.replies.map((reply) => (
                              <div key={reply.id}>
                                <span>匿名回覆・{formatDateTime(reply.createdAt)}</span>
                                <p>
                                  <RichText>{reply.content}</RichText>
                                </p>
                                {shared.user && reply.authorId === shared.user.uid ? (
                                  <ConfirmDialog
                                    trigger={<Button variant="ghost">刪除回覆</Button>}
                                    title="刪除這則回覆？"
                                    description="刪除後無法復原。"
                                    confirmLabel="確認刪除"
                                    onConfirm={() =>
                                      void runPostAction(
                                        () => shared.deleteReply(post.id, reply.id),
                                        '刪除回覆失敗',
                                      )
                                    }
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className={styles.postActions}>
                          <Button
                            variant="ghost"
                            aria-pressed={isLiked(post)}
                            onClick={() =>
                              void runPostAction(
                                () => shared.toggleLike(post.id, isLiked(post)),
                                '無法更新按讚',
                              )
                            }
                          >
                            {isLiked(post) ? (
                              <IconHeartFilled size={17} aria-hidden="true" />
                            ) : (
                              <IconHeart size={17} stroke={2} aria-hidden="true" />
                            )}{' '}
                            讚 {post.likes}
                          </Button>
                          <Button variant="ghost" onClick={() => savePostToNote(post)}>
                            <IconNotebook size={17} stroke={2} aria-hidden="true" />
                            加入我的筆記
                          </Button>
                          <ConfirmDialog
                            tone="warning"
                            trigger={
                              <Button
                                variant="ghost"
                                disabled={
                                  post.reported || (shared.enabled && !shared.user)
                                }
                              >
                                {post.reported ? '已檢舉' : '檢舉'}
                              </Button>
                            }
                            title="檢舉這則內容？"
                            description="檢舉後無法取消，網站管理者會審閱這則內容。"
                            confirmLabel="確認檢舉"
                            onConfirm={() => void reportPost(post.id)}
                          />
                          {post.ownedByCurrentUser ? (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditingContent(post.content);
                                }}
                              >
                                <IconPencil size={16} stroke={2} aria-hidden="true" />
                                編輯
                              </Button>
                              <ConfirmDialog
                                trigger={
                                  <Button variant="ghost" className={styles.deleteAction}>
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
                            </>
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
                <RichTextEditor
                  id="post-content"
                  ariaLabel="內容"
                  ariaContext="投稿"
                  value={postContent}
                  onChange={setPostContent}
                  minHeight={240}
                  maxLength={5000}
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
                    ? '共享投稿會公開顯示給所有使用者；免費方案僅共享文字，圖片保存在本機筆記。'
                    : 'Firebase 尚未設定，投稿內容僅儲存在這台裝置。'}
                </p>
              </form>
            </TabPanel>

            <TabPanel value="notes" className={styles.tabPanel}>
              <section className={styles.notesCard}>
                <QuestionNoteEditor
                  key={`${currentQuestion.id}-${hydrated ? 'ready' : 'hydrating'}`}
                  question={currentQuestion}
                  header="compact"
                  showDifficultButton={false}
                  showSimilarQuestions={false}
                  draft={noteDrafts[currentQuestion.id]}
                  onDraftChange={(draft) =>
                    setNoteDrafts((current) => ({
                      ...current,
                      [activeQuestion.id]: draft,
                    }))
                  }
                />
              </section>
            </TabPanel>
          </TabsRoot>
        </main>

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
              label: formatQuestionNumberLabel(question, true),
              ariaLabel: formatQuestionNumberLabel(question),
              difficult:
                question.format !== 'written' && difficultQuestionIds.has(question.id),
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
    </div>
  );
}
