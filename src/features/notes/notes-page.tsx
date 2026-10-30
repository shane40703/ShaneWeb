import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/content/content';
import {
  QuestionNoteEditor,
  type QuestionNoteDraft,
} from '@/components/question-note-editor';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import { getSubject, years } from '@/question-bank/catalog';
import {
  comparePaperQuestionOrder,
  formatQuestionNumberLabel,
} from '@/lib/study';
import { stripTextFormatting } from '@/lib/text-formatting';
import type { Question, SubjectId } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import styles from './notes-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  onRequestQuestionBank?: (subjectId: SubjectId, year?: number) => void;
  onRetryQuestionBank?: (subjectId: SubjectId) => void;
}) {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const routeHydrated = useClientReady();
  const [drafts, setDrafts] = useState<Record<string, QuestionNoteDraft>>({});
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
    onRequestQuestionBank?.(
      requestedSubject,
      requestedQuestionId ? parseQuestionId(requestedQuestionId)?.year : undefined,
    );
  }, [
    onRequestQuestionBank,
    requestedQuestion,
    requestedQuestionId,
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
          comparePaperQuestionOrder(left, right),
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
        title="正在載入題目"
        description="正在取得指定題目的筆記資料，請稍候。"
      />
    );
  }

  if (
    unresolvedStatus === 'error' &&
    !currentQuestion &&
    !pendingSubjectHasQuestions
  ) {
    return (
      <EmptyState
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
        title="題庫尚無資料"
        description="目前找不到這個科目的題目。"
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
    .sort(comparePaperQuestionOrder);
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
          right.year - left.year || comparePaperQuestionOrder(left, right),
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
        <section className={styles.editor}>
          <QuestionNoteEditor
            key={`${currentQuestion.id}-${hydrated ? 'ready' : 'hydrating'}`}
            question={currentQuestion}
            questions={questions}
            draft={activeDraft}
            onDraftChange={(draft) =>
              setDrafts((current) => ({
                ...current,
                [currentQuestion.id]: draft,
              }))
            }
          />
        </section>
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
                      ariaLabel={formatQuestionNumberLabel(item)}
                      active={item.id === currentQuestion.id}
                      difficult={
                        item.format !== 'written' &&
                        state.difficultQuestionIds.includes(item.id)
                      }
                      noted={hasNote}
                      onClick={() => navigateTo(item.id)}
                    >
                      {formatQuestionNumberLabel(item, true)}
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
                {visibleNoteEntries.map(({ id, subject, year, format, questionNumber, content, imageCount }) => (
                  <button key={id} onClick={() => void navigateTo(id)} aria-current={id === currentQuestion.id}>
                    <span>{year}・{getSubject(subject)?.shortName}・{formatQuestionNumberLabel({ format, questionNumber })}</span>
                    <strong>{stripTextFormatting(content).trim() || `圖片筆記 ${imageCount} 張`}</strong>
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
