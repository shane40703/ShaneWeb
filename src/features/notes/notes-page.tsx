import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconBold,
  IconHelpCircle,
  IconLoader2,
  IconNotebook,
  IconTrash,
} from '@tabler/icons-react';
import {
  appendImageFiles,
  ImageAttachments,
} from '@/components/image-attachments';
import {
  EmptyState,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button, ConfirmDialog, useToast } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import { getSubject, years } from '@/question-bank/catalog';
import { useDiscussionPublisher } from '@/lib/shared-discussions';
import { toggleBoldFormatting } from '@/lib/text-formatting';
import type { ImageAttachment, Question, SubjectId } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import styles from './notes-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boldSelection(
  textarea: HTMLTextAreaElement | null,
  value: string,
  onChange: (value: string) => void,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const result = toggleBoldFormatting(value, start, end);
  onChange(result.value);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
}

interface NoteDraft {
  content: string;
  images: ImageAttachment[];
}

export type NotesQuestionBankStatus = QuestionBankStatus | 'idle';

export function NotesPage({
  questions,
  questionBankStatus = 'ready',
  questionBankStatuses,
  onRequestQuestionBank,
  onRetryQuestionBank,
}: {
  questions: Question[];
  questionBankStatus?: QuestionBankStatus;
  questionBankStatuses?: Partial<Record<SubjectId, NotesQuestionBankStatus>>;
  onRequestQuestionBank?: (subjectId: SubjectId) => void;
  onRetryQuestionBank?: (subjectId: SubjectId) => void;
}) {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const routeHydrated = useClientReady();
  const [drafts, setDrafts] = useState<Record<string, NoteDraft>>({});
  const [pendingSubject, setPendingSubject] = useState<SubjectId>();
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
  const requestedSubject = requestedQuestionId
    ? parseQuestionId(requestedQuestionId)?.subject
    : undefined;
  const unresolvedSubject =
    pendingSubject ??
    (requestedQuestionId && !requestedQuestion ? requestedSubject : undefined);
  const unresolvedStatus = unresolvedSubject
    ? (questionBankStatuses?.[unresolvedSubject] ?? questionBankStatus)
    : questionBankStatus;
  const retrySubject = unresolvedSubject ?? currentQuestion?.subject;
  const pendingSubjectHasQuestions = pendingSubject
    ? questions.some((question) => question.subject === pendingSubject)
    : false;

  const navigateTo = useCallback(
    (questionId: string) =>
      router.replace(
        { pathname: '/notes', query: { question: questionId } },
        undefined,
        { shallow: true, scroll: false },
      ),
    [router],
  );

  useEffect(() => {
    if (
      !routeHydrated ||
      !requestedSubject ||
      requestedQuestion ||
      unresolvedStatus === 'error'
    ) {
      return;
    }
    onRequestQuestionBank?.(requestedSubject);
  }, [
    onRequestQuestionBank,
    requestedQuestion,
    requestedSubject,
    routeHydrated,
    unresolvedStatus,
  ]);

  useEffect(() => {
    if (!pendingSubject) return;
    const first = questions
      .filter((question) => question.subject === pendingSubject)
      .sort(
        (left, right) =>
          right.year - left.year ||
          left.questionNumber - right.questionNumber,
      )[0];
    if (!first) return;
    void Promise.resolve(navigateTo(first.id)).then(() => {
      setPendingSubject(undefined);
    });
  }, [navigateTo, pendingSubject, questions]);

  if (
    routeHydrated &&
    (router.isReady === false ||
      (Boolean(unresolvedSubject) &&
        (unresolvedStatus === 'idle' ||
          unresolvedStatus === 'loading' ||
          (Boolean(pendingSubject) && pendingSubjectHasQuestions))))
  ) {
    return (
      <EmptyState
        icon={IconLoader2}
        title="正在載入題目"
        description="正在取得指定題目的筆記資料，請稍候。"
      />
    );
  }

  if (unresolvedStatus === 'error') {
    return (
      <EmptyState
        icon={IconAlertCircle}
        title="題庫載入失敗"
        description="目前無法取得完整題庫，請重新載入後再試。"
        action={
          onRetryQuestionBank && retrySubject ? (
            <Button onClick={() => onRetryQuestionBank(retrySubject)}>
              重新載入
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (
    pendingSubject &&
    unresolvedStatus === 'ready' &&
    !pendingSubjectHasQuestions
  ) {
    return (
      <EmptyState
        icon={IconHelpCircle}
        title="題庫尚無資料"
        description="目前找不到這個科目的題目。"
      />
    );
  }

  if (!currentQuestion) {
    return (
      <EmptyState
        icon={requestedQuestionId ? IconHelpCircle : IconNotebook}
        title={requestedQuestionId ? '找不到指定題目' : '題庫尚無資料'}
        description={
          requestedQuestionId
            ? '這個題目可能已移除，請從題庫重新選擇。'
            : '加入題目後即可建立筆記。'
        }
      />
    );
  }

  const activeQuestion = currentQuestion;
  const activeDraft = drafts[currentQuestion.id];
  const subjectQuestions = questions.filter(
    (question) => question.subject === currentQuestion.subject,
  );
  const availableYears = [...new Set(subjectQuestions.map((question) => question.year))].sort((a, b) => b - a);
  const paperQuestions = questions
    .filter(
      (question) =>
        question.subject === currentQuestion.subject &&
        question.year === currentQuestion.year,
    )
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const noteIds = [
    ...new Set([...Object.keys(state.notes), ...Object.keys(state.noteImages)]),
  ];
  const noteEntries = noteIds
    .map((id) => {
      const parsed = parseQuestionId(id);
      return parsed
        ? {
            id,
            ...parsed,
            content: state.notes[id] ?? '',
            imageCount: state.noteImages[id]?.length ?? 0,
          }
        : null;
    })
    .filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    );
  const visibleNoteEntries = noteEntries.filter(
    (entry) =>
      entry.subject === currentQuestion.subject &&
      entry.year === currentQuestion.year,
  );

  function selectSubject(subjectId: SubjectId) {
    const first = questions
      .filter((question) => question.subject === subjectId)
      .sort(
        (left, right) =>
          right.year - left.year || left.questionNumber - right.questionNumber,
      )[0];
    if (first) {
      void navigateTo(first.id);
      return;
    }
    setPendingSubject(subjectId);
    onRequestQuestionBank?.(subjectId);
  }

  function selectYear(value: SelectorYear) {
    if (typeof value !== 'number') return;
    const first = questions.find(
      (question) =>
        question.subject === activeQuestion.subject && question.year === value,
    );
    if (first) void navigateTo(first.id);
  }

  const questionSelector = (
    <QuestionSelector
      subjectId={currentQuestion.subject}
      year={currentQuestion.year}
      yearOptions={years.map((year) => ({
        value: year,
        disabled: !availableYears.includes(year),
      }))}
      onSubjectChange={selectSubject}
      onYearChange={selectYear}
      ariaLabel="筆記題目選擇"
    />
  );

  return (
    <div
      className={styles.interactionGuard}
      inert={!routeHydrated || !hydrated}
    >
      {questionSelector}
      <div className={styles.layout}>
        <NoteEditor
          key={currentQuestion.id}
          question={currentQuestion}
          content={activeDraft?.content ?? state.notes[currentQuestion.id] ?? ''}
          images={activeDraft?.images ?? state.noteImages[currentQuestion.id] ?? []}
          onChange={(draft) =>
            setDrafts((current) => ({
              ...current,
              [currentQuestion.id]: draft,
            }))
          }
        />
        <aside className={styles.noteSidebar} aria-label="筆記題號導覽">
          <section className={styles.numberNavigator}>
            <header>
              <div>
                <span>QUESTION MAP</span>
                <h2>題號導覽</h2>
              </div>
              <strong>
                {paperQuestions.findIndex(
                  (item) => item.id === currentQuestion.id,
                ) + 1}
                /{paperQuestions.length}
              </strong>
            </header>
            <div
              className={styles.questionNumbers}
              role="group"
              aria-label="題號"
            >
              <QuestionNumberGrid>
                {paperQuestions.map((item) => {
                  const hasNote = Boolean(
                    state.notes[item.id]?.trim() ||
                    state.noteImages[item.id]?.length,
                  );

                  return (
                    <QuestionNumberButton
                      key={item.id}
                      ariaLabel={`第 ${item.questionNumber} 題`}
                      active={item.id === currentQuestion.id}
                      difficult={state.difficultQuestionIds.includes(item.id)}
                      noted={hasNote}
                      onClick={() => navigateTo(item.id)}
                    >
                      {item.questionNumber}
                    </QuestionNumberButton>
                  );
                })}
              </QuestionNumberGrid>
            </div>
            <footer className={styles.noteLegend}>
              <span><i />有筆記</span>
              <span data-tone="difficult"><i />難題</span>
            </footer>
          </section>
          <section className={styles.savedNotes}>
            <header><span>SAVED</span><h2>已儲存筆記</h2><strong>{visibleNoteEntries.length}</strong></header>
            {visibleNoteEntries.length ? (
              <div>
                {visibleNoteEntries.map(({ id, subject, year, questionNumber, content, imageCount }) => (
                  <button key={id} onClick={() => void navigateTo(id)} aria-current={id === currentQuestion.id}>
                    <span>{year}・{getSubject(subject)?.shortName}・第 {questionNumber} 題</span>
                    <strong>{content || `圖片筆記 ${imageCount} 張`}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p>尚未儲存任何筆記。</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function NoteEditor({
  question,
  content,
  images,
  onChange,
}: {
  question: Question;
  content: string;
  images: ImageAttachment[];
  onChange: (draft: NoteDraft) => void;
}) {
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const discussion = useDiscussionPublisher(question.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sharing, setSharing] = useState(false);
  const hasSavedNote = Boolean(
    state.notes[question.id]?.trim() || state.noteImages[question.id]?.length,
  );

  function saveNote() {
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    notify(content.trim() || images.length ? '筆記已儲存' : '筆記已刪除');
  }

  async function shareNote() {
    if (sharing) return;
    const trimmed = content.trim();
    if (!trimmed && !images.length) {
      notify('尚無可分享的筆記');
      return;
    }
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    setSharing(true);
    try {
      await discussion.publish('explanation', trimmed, images);
      notify(
        '已分享至詳解與討論',
        discussion.enabled && images.length ? '文字與圖片已同步共享。' : undefined,
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

  function deleteNote() {
    dispatch({
      type: 'save-note',
      questionId: question.id,
      content: '',
      images: [],
    });
    onChange({ content: '', images: [] });
    notify('筆記已刪除');
  }

  return (
    <section className={styles.editor}>
      <div className={styles.questionMeta}>
        <Tag>{question.year} 年</Tag>
        <Tag tone="green">{getSubject(question.subject)?.name}</Tag>
        <Tag tone="purple">第 {question.questionNumber} 題</Tag>
        {question.source.kind === 'sample' ? (
          <Tag tone="purple">示範題</Tag>
        ) : null}
      </div>
      <QuestionSourceLine question={question} />
      <QuestionPrompt question={question} />
      <QuestionAnswerPanel
        question={question}
        heading={null}
        ariaLabel="題目選項"
      />
      <div className={styles.noteToolbar}>
        <label htmlFor="question-note">我的筆記</label>
        <button
          type="button"
          aria-label="切換選取文字的粗體格式"
          onClick={() =>
            boldSelection(textareaRef.current, content, (nextContent) =>
              onChange({ content: nextContent, images }),
            )
          }
        >
          <IconBold size={16} stroke={2.4} aria-hidden="true" />
          粗體
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id="question-note"
        value={content}
        onChange={(event) =>
          onChange({ content: event.target.value, images })
        }
        onPaste={(event) => {
          const files = [...event.clipboardData.files].filter((file) =>
            file.type.startsWith('image/'),
          );
          if (!files.length) return;
          event.preventDefault();
          void appendImageFiles(images, files).then((result) => {
            onChange({ content, images: result.images });
            notify(
              result.images.length > images.length
                ? '已貼上筆記圖片'
                : '無法貼上圖片',
              result.error || undefined,
            );
          });
        }}
        rows={12}
        placeholder="記下法條、公式、易錯觀念或解題步驟，也可以直接貼上截圖…"
      />
      <ImageAttachments
        images={images}
        onChange={(nextImages) => onChange({ content, images: nextImages })}
        label="上傳筆記圖片"
      />
      <div className={styles.editorFooter}>
        <span>{content.length} 字</span>
        <div>
          {hasSavedNote ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  <IconTrash size={16} stroke={2} aria-hidden="true" />
                  刪除筆記
                </Button>
              }
              title={`刪除第 ${question.questionNumber} 題筆記？`}
              description="文字與上傳的筆記圖片都會刪除，且無法復原。"
              confirmLabel="確認刪除"
              onConfirm={deleteNote}
            />
          ) : null}
          <Button disabled={sharing} onClick={() => void shareNote()}>
            {sharing ? '正在分享…' : '分享至詳解與討論'}
          </Button>
          <Button variant="primary" onClick={saveNote}>儲存筆記</Button>
        </div>
      </div>
    </section>
  );
}
