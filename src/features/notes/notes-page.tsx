import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconLoader2, IconNotebook } from '@tabler/icons-react';
import { ImageAttachments } from '@/components/image-attachments';
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
import { Button, useToast } from '@/components/ui/ui';
import { getSubject, years } from '@/question-bank/catalog';
import type { ImageAttachment, Question, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './notes-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function NotesPage({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const currentQuestion =
    questions.find((question) => question.id === (valueOf(router.query.question) ?? '')) ??
    questions[0];

  if (!currentQuestion) {
    return <EmptyState icon={IconNotebook} title="題庫尚無資料" description="加入題目後即可建立筆記。" />;
  }

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
    .map((id) => ({
      question: questions.find((question) => question.id === id),
      content: state.notes[id] ?? '',
      imageCount: state.noteImages[id]?.length ?? 0,
    }))
    .filter(
      (
        entry,
      ): entry is {
        question: Question;
        content: string;
        imageCount: number;
      } => Boolean(entry.question),
    );

  function navigateTo(questionId: string) {
    void router.replace({ pathname: '/notes', query: { question: questionId } }, undefined, {
      shallow: true,
      scroll: false,
    });
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

  function selectYear(value: SelectorYear) {
    if (typeof value !== 'number') return;
    const first = questions.find(
      (question) =>
        question.subject === currentQuestion.subject && question.year === value,
    );
    if (first) navigateTo(first.id);
  }

  const questionSelector = (
    <QuestionSelector
      heading="選擇筆記題目"
      description="筆記會自動跟題目對應，並只保存在目前瀏覽器。"
      subjectId={currentQuestion.subject}
      year={currentQuestion.year}
      yearOptions={years.map((year) => ({
        value: year,
        disabled: !availableYears.includes(year),
      }))}
      onSubjectChange={selectSubject}
      onYearChange={selectYear}
      ariaLabel="筆記題目選擇"
      summary={
        <>
          已選 <strong>{getSubject(currentQuestion.subject)?.name} · {currentQuestion.year} 年 · 第 {currentQuestion.questionNumber} 題</strong>
        </>
      }
      action={<span className={styles.selectorHint}>筆記對應目前題目</span>}
    />
  );

  if (!hydrated) {
    return (
      <>
        {questionSelector}
        <section className={styles.loadingPanel}>
          <EmptyState icon={IconLoader2} title="正在讀取筆記" description="請稍候。" />
        </section>
      </>
    );
  }

  return (
    <>
      {questionSelector}
      <div className={styles.layout}>
        <NoteEditor
          key={currentQuestion.id}
          question={currentQuestion}
          initialValue={state.notes[currentQuestion.id] ?? ''}
          initialImages={state.noteImages[currentQuestion.id] ?? []}
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
            </footer>
          </section>
          <section className={styles.savedNotes}>
            <header><span>SAVED</span><h2>已儲存筆記</h2><strong>{noteEntries.length}</strong></header>
            {noteEntries.length ? (
              <div>
                {noteEntries.map(({ question, content, imageCount }) => (
                  <button key={question.id} onClick={() => navigateTo(question.id)} aria-current={question.id === currentQuestion.id}>
                    <span>{question.year}・{getSubject(question.subject)?.shortName}・第 {question.questionNumber} 題</span>
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
    </>
  );
}

function NoteEditor({
  question,
  initialValue,
  initialImages,
}: {
  question: Question;
  initialValue: string;
  initialImages: ImageAttachment[];
}) {
  const { dispatch } = useAppState();
  const { notify } = useToast();
  const [content, setContent] = useState(initialValue);
  const [images, setImages] = useState(initialImages);

  function saveNote() {
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    notify(content.trim() || images.length ? '筆記已儲存' : '筆記已刪除');
  }

  function shareNote() {
    const trimmed = content.trim();
    if (!trimmed && !images.length) {
      notify('尚無可分享的筆記');
      return;
    }
    const now = new Date().toISOString();
    dispatch({
      type: 'add-discussion-post',
      post: {
        id: `post-note-${now}`,
        questionId: question.id,
        type: 'explanation',
        content: trimmed,
        images,
        createdAt: now,
        likes: 0,
        replies: [],
        reported: false,
      },
    });
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    notify('已分享至詳解與討論');
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
      <QuestionPrompt question={question} />
      <QuestionSourceLine question={question} />
      <QuestionAnswerPanel question={question} />
      <label htmlFor="question-note">我的筆記</label>
      <textarea
        id="question-note"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={12}
        placeholder="記下法條、公式、易錯觀念或解題步驟…"
      />
      <ImageAttachments
        images={images}
        onChange={setImages}
        label="上傳筆記圖片"
      />
      <div className={styles.editorFooter}>
        <span>{content.length} 字</span>
        <div>
          <Button onClick={shareNote}>分享至詳解與討論</Button>
          <Button variant="primary" onClick={saveNote}>儲存筆記</Button>
        </div>
      </div>
    </section>
  );
}
