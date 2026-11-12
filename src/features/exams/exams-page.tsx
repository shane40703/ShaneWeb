import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
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
import { CopyQuestionButton } from '@/components/copy-question-button';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { QuestionMapDrawer } from '@/components/question-map-drawer';
import {
  QuestionNoteEditor,
  type QuestionNoteDraft,
} from '@/components/question-note-editor';
import { RichText } from '@/components/rich-text';
import { QuestionBodyPlaceholder } from '@/components/question-body-placeholder';
import { hasSimilarQuestionsBlock, SimilarQuestions } from '@/components/similar-questions';
import { RichTextEditor } from '@/components/rich-text-editor-lazy';
import { Tab, TabList, TabPanel, TabsRoot } from '@/components/tabs';
import { trackPractice } from '@/lib/analytics';
import {
  examsHref,
  examsPaperStart,
  examsPlace,
  examsQuery,
  examsQuestionHref,
  examsQuestionId,
  examsSlug,
  examsSlugParts,
  examsSubjectStart,
  examsTab,
  type ExamsTab,
} from '@/lib/question-path';
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
import { getSubject, subjects, years } from '@/question-bank/catalog';
import {
  buildPaperIndex,
  hasBody,
  type PaperTopics,
  type QuestionEntry,
} from '@/question-bank/derived-data';
import type {
  DiscussionPost,
  DiscussionPostType,
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
import { ExamsHub } from './exams-hub';
import { pushExamsPlace } from './exams-layout';
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

/** The reader folding or unfolding the selector, where they did it (see selectorAt). */
interface SelectorToggle {
  at: string;
  expanded: boolean;
}

function BodyPending({
  status,
  onRetry,
}: {
  status: QuestionBankStatus;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.bodyPending} data-status={status}>
      <QuestionBodyPlaceholder status={status} onRetry={() => onRetry?.()} />
    </div>
  );
}

/**
 * 歷屆試題討論版 at every address under /exams. Each starts with the same subject and year
 * selector, in the same place; under it a question's address shows that question, and the board
 * itself, a subject and a paper list what they hold (ExamsHub) and show no question. The
 * component stays mounted for every move between them, so answers, 筆記 drafts and unsent
 * posts survive a trip to an overview and back.
 */
export function ExamsPage({
  questions,
  questionBankStatus = 'ready',
  onRetryQuestionBank,
  paperTopics,
}: {
  /** The bank to navigate over; a question has a body once its paper has loaded. */
  questions: readonly QuestionEntry[];
  questionBankStatus?: QuestionBankStatus;
  onRetryQuestionBank?: () => void;
  /** The topic words of the prerendered paper page. */
  paperTopics?: PaperTopics | null;
}) {
  const router = useRouter();
  const { state, dispatch, hydrated } = useAppState();
  const { notify } = useToast();
  const routeHydrated = useClientReady();
  const routeReady = routeHydrated && router.isReady !== false;
  // In the path, so the prerendered page already shows it and search engines can read it.
  // Only an address that names a question shows one.
  const place = examsPlace(router.query.slug);
  const requestedQuestionId = examsQuestionId(router.query.slug);
  const queryTab = routeReady ? examsTab(router.query.tab) : undefined;
  const requestedQuestion = requestedQuestionId
    ? questions.find((question) => question.id === requestedQuestionId)
    : undefined;
  const currentEntry = requestedQuestion;
  const currentBody = currentEntry && hasBody(currentEntry) ? currentEntry : undefined;
  // While another paper downloads, the card keeps its size: the number, tiles and selector
  // have already moved on, and nothing else jumps.
  const [shownBody, setShownBody] = useState(currentBody);
  if (currentBody && currentBody !== shownBody) setShownBody(currentBody);
  const currentQuestion = currentBody ?? shownBody;
  const bodyPending = !currentBody && questionBankStatus !== 'ready';
  const currentQuestionId = currentEntry?.id;
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
  const index = useMemo(() => buildPaperIndex(questions), [questions]);
  const placeKey = examsHref(examsSlugParts(router.query.slug));
  // One-column pages fold the subject / year selector behind a summary button (the CSS
  // decides when). Where choosing is the whole task, on the board and a subject, it starts
  // open; a paper and a question start folded. The reader's toggle holds on the overview it was
  // made on, or across questions, so 上一題, 下一題 and the 題號 keep it as they always did and
  // the compact bar stays under the finger. A choice folds it again.
  const selectorAt = place.kind === 'question' ? 'question' : placeKey;
  const [selectorToggle, setSelectorToggle] = useState<SelectorToggle | null>(null);
  // Anywhere else, Back included, starts at that address's own default.
  if (selectorToggle && selectorToggle.at !== selectorAt) setSelectorToggle(null);
  const selectorExpanded =
    selectorToggle?.at === selectorAt
      ? selectorToggle.expanded
      : place.kind === 'bank' || place.kind === 'subject';
  const selectorId = useId();
  const summaryRef = useRef<HTMLButtonElement>(null);
  const compactNavRef = useRef<HTMLDivElement>(null);
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const focusVerdictFor = useRef<string | null>(null);
  // Arriving at an overview by a move inside the page (not by loading it) starts the keyboard
  // and screen readers at its lead, as a full load starts them at the top.
  const [loadedAt] = useState(placeKey);
  const [moved, setMoved] = useState(false);
  if (!moved && placeKey !== loadedAt) setMoved(true);
  // An overview has no question, so it listens to no discussion.
  const shared = useSharedDiscussions(currentQuestionId ?? null);
  const discussionQuestionIds = useDiscussionQuestionIds(
    currentEntry ? `${currentEntry.subject}-${currentEntry.year}-` : null,
  );
  const currentPractice = currentQuestionId ? practice[currentQuestionId] : undefined;
  const revealed = currentPractice?.revealed ?? false;

  // An old link arrives through a redirect, and a redirect keeps the query string.
  useEffect(() => {
    if (!routeReady || router.query.question === undefined) return;
    void router.replace(
      {
        pathname: router.pathname,
        query: examsQuery(examsSlugParts(router.query.slug), examsTab(router.query.tab)),
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [routeReady, router]);

  // 看解答 disappears with the reveal, so focus moves to the verdict line.
  useEffect(() => {
    if (!revealed || focusVerdictFor.current !== currentQuestionId) return;
    focusVerdictFor.current = null;
    verdictRef.current?.focus();
  }, [revealed, currentQuestionId]);

  // A paper's row opens its question: a new history entry from the top of the page. Moving
  // between questions and tabs replaces the entry and keeps the scroll, so reading a paper adds
  // no history.
  function navigateToPlace(slug: readonly string[], mode: 'push' | 'replace' = 'replace') {
    if (mode === 'push') {
      pushExamsPlace(router, slug);
      return;
    }
    void router.replace(
      { pathname: router.pathname, query: examsQuery(slug, tab) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  // The selector shows the subject and the year the address names, where it names them.
  const selectedSubject = place.kind === 'bank' ? undefined : place.subject;
  const selectedYear =
    place.kind === 'paper' || place.kind === 'question' ? place.year : undefined;
  const subjectYears = selectedSubject
    ? (index[selectedSubject] ?? []).map(([year]) => year)
    : [];
  const selectedSubjectName = selectedSubject ? getSubject(selectedSubject)?.name : undefined;

  // The tiles link the subject and paper pages, for search engines and new tabs; a plain
  // click opens that subject's newest paper, or this subject's paper of that year, at its first
  // question, on the question's tab. A paper switch is a new history entry, so Back returns to
  // the question being read. A tile naming the address on screen only folds the selector.
  function openStart(slug: readonly string[] | undefined) {
    const wasOpen = selectorExpanded;
    setSelectorToggle({ at: selectorAt, expanded: false });
    if (slug && examsHref(slug) !== placeKey) {
      pushExamsPlace(router, slug, place.kind === 'question' ? tab : 'question');
    }
    // The chosen tile folds away, so the keyboard goes to the summary that opens it again.
    if (wasOpen) summaryRef.current?.focus();
  }

  function selectSubject(subjectId: SubjectId) {
    openStart(examsSubjectStart(index, subjectId));
  }

  function selectYear(year: SelectorYear) {
    if (typeof year !== 'number' || !selectedSubject) return;
    openStart(examsPaperStart(index, selectedSubject, year));
  }

  // First in every branch, so React keeps it, and the keyboard on its tile, across moves.
  const selector = (
    <div className={styles.selectorWrap} data-expanded={selectorExpanded}>
      <button
        ref={summaryRef}
        type="button"
        className={styles.selectorSummary}
        aria-expanded={selectorExpanded}
        aria-controls={selectorId}
        aria-label="展開科目與年度"
        onClick={() => setSelectorToggle({ at: selectorAt, expanded: !selectorExpanded })}
      >
        <span>
          {!selectedSubjectName
            ? '選擇科目'
            : selectedYear === undefined
              ? `${selectedSubjectName}・選擇年度`
              : `${selectedSubjectName}・${selectedYear} 年`}
        </span>
        <IconChevronDown size={18} stroke={2} aria-hidden="true" />
      </button>
      <div id={selectorId} className={styles.selectorBody}>
        <QuestionSelector
          subjectId={selectedSubject}
          year={selectedYear}
          yearOptions={years.map((year) => ({
            value: year,
            disabled: !subjectYears.includes(year),
          }))}
          disabledSubjectIds={subjects
            .filter((item) => !index[item.id]?.length)
            .map((item) => item.id)}
          onSubjectChange={selectSubject}
          onYearChange={selectYear}
          subjectHref={(subjectId) => examsHref([subjectId])}
          yearHref={
            selectedSubject
              ? (value) => examsHref([selectedSubject, String(value)])
              : undefined
          }
          ariaLabel="題目選擇"
        />
      </div>
    </div>
  );

  // After every hook, so the page keeps its state on the way to an overview and back.
  if (place.kind !== 'question') {
    return (
      <div className={styles.page}>
        {selector}
        <ExamsHub
          place={place}
          questions={questions}
          paperTopics={paperTopics}
          status={questionBankStatus}
          onRetry={onRetryQuestionBank}
          onNavigate={(slug) => navigateToPlace(slug, 'push')}
          focusLead={moved}
        />
      </div>
    );
  }

  if (routeHydrated && router.isReady === false) {
    return (
      <div className={styles.page}>
        {selector}
        <EmptyState
          title="正在載入題目"
          description="正在取得指定題目的詳解與討論，請稍候。"
        />
      </div>
    );
  }

  // A question on its way is not missing: the page shows, with a card that waits for it.
  if (!currentEntry || (!currentBody && !bodyPending)) {
    return (
      <div className={styles.page}>
        {selector}
        <EmptyState
          title={questions.length ? '找不到指定題目' : '題庫尚無資料'}
          description={
            questions.length
              ? '這個題目可能已移除，請用上方的科目、年度按鈕重新選擇。'
              : '加入題目後即可使用詳解與討論。'
          }
        />
      </div>
    );
  }

  const activeEntry = currentEntry;
  const subject = getSubject(currentEntry.subject);
  const subjectQuestions = questions
    .filter((question) => question.subject === currentEntry.subject)
    .sort(
      (left, right) => right.year - left.year || comparePaperQuestionOrder(left, right),
    );
  const paperQuestions = questions
    .filter(
      (question) =>
        question.subject === currentEntry.subject &&
        question.year === currentEntry.year,
    )
    .sort(comparePaperQuestionOrder);
  const currentIndex = subjectQuestions.findIndex(
    (question) => question.id === currentEntry.id,
  );
  const paperIndex = paperQuestions.findIndex(
    (question) => question.id === currentEntry.id,
  );
  const posts = shared.posts;
  const difficultQuestionIds = new Set(state.difficultQuestionIds);
  // Of the body on screen, which can still be the last question while the next paper
  // downloads: the hidden card keeps that question's shape, so nothing under it moves.
  const shownEntry = currentQuestion ?? currentEntry;
  const difficult = state.difficultQuestionIds.includes(shownEntry.id);
  const written = shownEntry.format === 'written';
  const selected = currentPractice?.selected;
  const correct = currentQuestion ? isQuestionCorrect(currentQuestion, selected) : false;
  const builtInExplanation = currentBody?.explanation?.trim()
    ? currentBody.explanation
    : undefined;
  const explanationPosts = posts.filter((post) =>
    explanationPostTypes.includes(post.type),
  );
  const hasExplanation = Boolean(builtInExplanation) || explanationPosts.length > 0;
  // No question has shown yet and its paper is on its way, as after a tile from an overview:
  // the page is all there, with a card in place of the question that waits or offers a retry.
  const firstPending = (
    <section className={`${styles.questionCard} ${styles.firstPending}`} data-loading>
      <BodyPending status={questionBankStatus} onRetry={onRetryQuestionBank} />
    </section>
  );
  /** The paper's tiles, shared by the aside and the 題號 drawer of the compact bar. */
  const pickerQuestions = paperQuestions.map((question) => ({
    id: question.id,
    questionNumber: question.questionNumber,
    label: formatQuestionNumberLabel(question, true),
    ariaLabel: formatQuestionNumberLabel(question),
    difficult: question.format !== 'written' && difficultQuestionIds.has(question.id),
    hasContent:
      (hasBody(question) && Boolean(question.explanation?.trim())) ||
      discussionQuestionIds.has(question.id),
  }));

  function navigateTo(questionId: string) {
    navigateToPlace(examsSlug(questionId));
  }

  // The compact bar scrolls with the page, so the footer's 上一題／下一題 comes back to it and
  // the new question's start. Two-column pages hide the bar and stay where they are.
  function navigateFromFooter(questionId: string) {
    navigateTo(questionId);
    compactNavRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function setTab(nextTab: ExamsTab) {
    setTabOverride({ tab: nextTab, queryTab });
    void router.replace(
      { pathname: router.pathname, query: examsQuery(examsSlug(activeEntry.id), nextTab) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  // Answers are kept under the question in the URL, where the card reads them back.
  function selectOption(value: number | undefined) {
    setPractice((current) => ({
      ...current,
      [activeEntry.id]: { selected: value, revealed: false },
    }));
  }

  function reveal() {
    focusVerdictFor.current = activeEntry.id;
    trackPractice(
      practice[activeEntry.id]?.selected === undefined
        ? 'answer_revealed'
        : 'question_answered',
      'exams',
      activeEntry.subject,
    );
    setPractice((current) => ({
      ...current,
      [activeEntry.id]: {
        selected: current[activeEntry.id]?.selected,
        revealed: true,
      },
    }));
  }

  function reset() {
    setPractice((current) => ({
      ...current,
      [activeEntry.id]: { revealed: false },
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
    // The post belongs to the question in the URL, which can be ahead of the body on screen.
    const draft = noteDrafts[activeEntry.id];
    const currentContent = draft?.content ?? state.notes[activeEntry.id] ?? '';
    const importedContent = post.content;
    const content = mergeRichTextValues(currentContent, importedContent);
    const existingImages = draft?.images ?? state.noteImages[activeEntry.id] ?? [];
    const imageIds = new Set(existingImages.map((image) => image.id));
    const images = [
      ...existingImages,
      ...post.images.filter((image) => !imageIds.has(image.id)),
    ];
    dispatch({
      type: 'save-note',
      questionId: activeEntry.id,
      content,
      images,
    });
    setNoteDrafts((current) => {
      const next = { ...current };
      delete next[activeEntry.id];
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
      {selector}

      <div className={styles.examsLayout}>
        <main className={styles.contentColumn}>
          <div className={styles.compactNav} ref={compactNavRef}>
            <div className={styles.compactPosition}>
              <strong>
                {paperIndex + 1} / {paperQuestions.length}
              </strong>
              <span>
                {subject?.shortName}・{currentEntry.year} 年
              </span>
            </div>
            <div className={styles.compactActions}>
              <Button
                variant="icon"
                aria-label="上一題"
                disabled={currentIndex <= 0}
                onClick={() =>
                  subjectQuestions[currentIndex - 1] &&
                  navigateTo(subjectQuestions[currentIndex - 1].id)
                }
              >
                <IconArrowLeft size={18} stroke={2} aria-hidden="true" />
              </Button>
              <Button
                variant="icon"
                aria-label="下一題"
                disabled={currentIndex >= subjectQuestions.length - 1}
                onClick={() =>
                  subjectQuestions[currentIndex + 1] &&
                  navigateTo(subjectQuestions[currentIndex + 1].id)
                }
              >
                <IconArrowRight size={18} stroke={2} aria-hidden="true" />
              </Button>
              <QuestionMapDrawer
                current={paperIndex + 1}
                total={paperQuestions.length}
                questions={pickerQuestions}
                value={currentEntry.id}
                onValueChange={navigateTo}
                showStatusLegend
              />
            </div>
          </div>

          <TabsRoot value={tab} onValueChange={setTab} ariaLabel="題目分頁" variant="outline">
            <TabList>
              <Tab value="question">題目</Tab>
              <Tab value="discussion" badge={posts.length > 0 ? posts.length : undefined}>
                討論區
              </Tab>
              <Tab value="notes">筆記</Tab>
            </TabList>

            <TabPanel value="question" className={styles.tabPanel}>
              {currentQuestion ? (
                <section
                  className={styles.questionCard}
                  data-loading={bodyPending || undefined}
                >
                  {bodyPending ? (
                    <BodyPending status={questionBankStatus} onRetry={onRetryQuestionBank} />
                  ) : null}
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
                      <div className={styles.copyAction}>
                        <CopyQuestionButton key={currentQuestion.id} question={currentQuestion} />
                      </div>
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
                        navigateFromFooter(subjectQuestions[currentIndex - 1].id)
                      }
                    >
                      <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
                    </Button>
                    <Button
                      disabled={currentIndex >= subjectQuestions.length - 1}
                      onClick={() =>
                        subjectQuestions[currentIndex + 1] &&
                        navigateFromFooter(subjectQuestions[currentIndex + 1].id)
                      }
                    >
                      下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
                    </Button>
                  </footer>
                </section>
              ) : (
                firstPending
              )}
              {currentBody && hasSimilarQuestionsBlock(currentBody) ? (
                <section className={styles.similarCard}>
                  <SimilarQuestions question={currentBody} basePath="/exams" />
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
              {currentQuestion ? (
                <section
                  className={styles.notesCard}
                  data-loading={bodyPending || undefined}
                >
                  {bodyPending ? (
                    <BodyPending status={questionBankStatus} onRetry={onRetryQuestionBank} />
                  ) : null}
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
                        [currentQuestion.id]: draft,
                      }))
                    }
                  />
                </section>
              ) : (
                firstPending
              )}
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
              {paperIndex + 1}/{paperQuestions.length}
            </strong>
          </header>
          <QuestionNumberPicker
            questions={pickerQuestions}
            value={currentEntry.id}
            onValueChange={navigateTo}
            hrefFor={examsQuestionHref}
            showStatusLegend
          />
        </aside>
      </div>
    </div>
  );
}
