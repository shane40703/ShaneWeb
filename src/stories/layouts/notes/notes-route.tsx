import { NotesPage } from '@/features/notes/notes-page';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { fixtureSubjectQuestions } from '../../fixtures/questions';

const allSubjectIds = subjects.map((subject) => subject.id);

/** 範例題庫裡的法規題目，順序跟伺服器一樣。 */
export const notesInitialQuestions = fixtureSubjectQuestions(allSubjectIds[0]);

/**
 * /notes 的頁面元件（src/pages/notes.tsx 有 getStaticProps，不能直接 import）。
 * 網站靠題卷索引知道每一題、只下載看到的那一卷；範例題庫的題號不連續，組不出索引，
 * 這裡改成向（範例）題庫要所有科目，交給 NotesPage 的內容一樣。網址參數由 meta 的
 * withStatefulRouter 切換，故事裡點題號、已儲存筆記或切換科目年度會像網站一樣換到那一題。
 */
export function NotesRoute({
  initialQuestions = notesInitialQuestions,
}: {
  initialQuestions?: Question[];
}) {
  const bank = useSubjectQuestions(allSubjectIds);
  const questions = [
    ...new Map(
      [...initialQuestions, ...bank.questions].map((question) => [question.id, question]),
    ).values(),
  ];

  return (
    <PersonalLayout>
      <NotesPage
        questions={questions}
        questionBankStatus={bank.status}
        onRetryQuestionBank={bank.retry}
      />
    </PersonalLayout>
  );
}
