import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconLoader2, IconNotebook } from '@tabler/icons-react';
import { EmptyState, PageHeader, Tag } from '@/components/content/content';
import { Button, SimpleSelect, useToast } from '@/components/ui/ui';
import { getQuestion, getSubject, questions, subjects } from '@/data/questions';
import type { Question, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './notes-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function NotesPage() {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const currentQuestion = getQuestion(valueOf(router.query.question) ?? '') ?? questions[0];

  if (!currentQuestion) {
    return <EmptyState icon={IconNotebook} title="題庫尚無資料" description="加入題目後即可建立筆記。" />;
  }

  const subjectQuestions = questions.filter((question) => question.subject === currentQuestion.subject);
  const availableYears = [...new Set(subjectQuestions.map((question) => question.year))].sort((a, b) => b - a);
  const paperQuestions = questions.filter(
    (question) => question.subject === currentQuestion.subject && question.year === currentQuestion.year,
  );
  const noteEntries = Object.entries(state.notes)
    .map(([id, content]) => ({ question: getQuestion(id), content }))
    .filter((entry): entry is { question: Question; content: string } => Boolean(entry.question));

  if (!hydrated) {
    return (
      <>
        <PageHeader
          eyebrow="PERSONAL NOTES"
          title="使用者筆記"
          description="筆記會自動跟題目對應，並只保存在目前瀏覽器。"
        />
        <section className={styles.loadingPanel}>
          <EmptyState icon={IconLoader2} title="正在讀取筆記" description="請稍候。" />
        </section>
      </>
    );
  }

  function navigateTo(questionId: string) {
    void router.replace({ pathname: '/notes', query: { question: questionId } }, undefined, {
      shallow: true,
      scroll: false,
    });
  }

  function selectSubject(subjectId: SubjectId) {
    const first = questions.find((question) => question.subject === subjectId);
    if (first) navigateTo(first.id);
  }

  function selectYear(value: string) {
    const first = questions.find(
      (question) => question.subject === currentQuestion.subject && question.year === Number(value),
    );
    if (first) navigateTo(first.id);
  }

  return (
    <>
      <PageHeader
        eyebrow="PERSONAL NOTES"
        title="使用者筆記"
        description="筆記會自動跟題目對應，並只保存在目前瀏覽器。"
      />
      <section className={styles.selectors}>
        <SimpleSelect
          label="科目"
          value={currentQuestion.subject}
          options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
          onValueChange={selectSubject}
        />
        <SimpleSelect
          label="年份"
          value={String(currentQuestion.year)}
          options={availableYears.map((year) => ({ value: String(year), label: `民國 ${year} 年` }))}
          onValueChange={selectYear}
        />
        <SimpleSelect
          label="題號"
          value={currentQuestion.id}
          options={paperQuestions.map((question) => ({ value: question.id, label: `第 ${question.questionNumber} 題` }))}
          onValueChange={navigateTo}
        />
      </section>
      <div className={styles.layout}>
        <NoteEditor key={currentQuestion.id} question={currentQuestion} initialValue={state.notes[currentQuestion.id] ?? ''} />
        <aside className={styles.savedNotes}>
          <header><span>SAVED</span><h2>已儲存筆記</h2><strong>{noteEntries.length}</strong></header>
          {noteEntries.length ? (
            <div>
              {noteEntries.map(({ question, content }) => (
                <button key={question.id} onClick={() => navigateTo(question.id)} aria-current={question.id === currentQuestion.id}>
                  <span>{question.year}・{getSubject(question.subject)?.shortName}・第 {question.questionNumber} 題</span>
                  <strong>{content}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>尚未儲存任何筆記。</p>
          )}
        </aside>
      </div>
    </>
  );
}

function NoteEditor({ question, initialValue }: { question: Question; initialValue: string }) {
  const { dispatch } = useAppState();
  const { notify } = useToast();
  const [content, setContent] = useState(initialValue);

  function saveNote() {
    dispatch({ type: 'save-note', questionId: question.id, content });
    notify(content.trim() ? '筆記已儲存' : '筆記已刪除');
  }

  return (
    <section className={styles.editor}>
      <div className={styles.questionMeta}>
        <Tag>{question.year} 年</Tag>
        <Tag tone="green">{getSubject(question.subject)?.name}</Tag>
        <Tag tone="purple">第 {question.questionNumber} 題</Tag>
      </div>
      <h2>{question.text}</h2>
      <label htmlFor="question-note">我的筆記</label>
      <textarea
        id="question-note"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={12}
        placeholder="記下法條、公式、易錯觀念或解題步驟…"
      />
      <div className={styles.editorFooter}>
        <span>{content.length} 字</span>
        <Button variant="primary" onClick={saveNote}>儲存筆記</Button>
      </div>
    </section>
  );
}
