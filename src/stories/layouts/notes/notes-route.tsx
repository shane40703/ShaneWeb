import { useCallback, useMemo, useState } from 'react';
import { NotesPage, type NotesQuestionBankStatus } from '@/features/notes/notes-page';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { fixtureSubjectQuestions } from '../../fixtures/questions';

const allSubjectIds = subjects.map((subject) => subject.id);

/** getStaticProps 預先載入的題目：第一個科目（法規）的整科題目，順序跟伺服器一樣。 */
export const notesInitialQuestions = fixtureSubjectQuestions(allSubjectIds[0]);

/**
 * /notes 的頁面元件（src/pages/notes.tsx 有 getStaticProps，不能直接 import）。
 * 照抄頁面的做法：一開始只有預先載入的法規題目，網址指定其他科目、點已儲存筆記或
 * 切換科目時，才向（範例）題庫要那個科目的題目。網址參數由 meta 的 withStatefulRouter
 * 切換，故事裡點題號、已儲存筆記或切換科目年度會像網站一樣換到那一題。
 */
export function NotesRoute({
  initialQuestions = notesInitialQuestions,
}: {
  initialQuestions?: Question[];
}) {
  const initialSubject = initialQuestions[0]?.subject ?? allSubjectIds[0];
  const [requestedSubjects, setRequestedSubjects] = useState<SubjectId[]>([]);
  const [requestedYears, setRequestedYears] = useState<
    Partial<Record<SubjectId, number[] | null>>
  >({});
  const shouldLoad = (subjectId: SubjectId) =>
    subjectId !== initialSubject && requestedSubjects.includes(subjectId);

  const yearsFor = (subjectId: SubjectId) => requestedYears[subjectId] ?? undefined;
  const lawBank = useSubjectQuestions(shouldLoad('law') ? ['law'] : [], yearsFor('law'));
  const environmentBank = useSubjectQuestions(
    shouldLoad('env') ? ['env'] : [],
    yearsFor('env'),
  );
  const constructionBank = useSubjectQuestions(
    shouldLoad('construction') ? ['construction'] : [],
    yearsFor('construction'),
  );
  const structureBank = useSubjectQuestions(
    shouldLoad('structure') ? ['structure'] : [],
    yearsFor('structure'),
  );
  const bankBySubject = {
    law: lawBank,
    env: environmentBank,
    construction: constructionBank,
    structure: structureBank,
  } as const;
  const questions = useMemo(
    () => [
      ...initialQuestions,
      ...lawBank.questions,
      ...environmentBank.questions,
      ...constructionBank.questions,
      ...structureBank.questions,
    ],
    [
      constructionBank.questions,
      environmentBank.questions,
      initialQuestions,
      lawBank.questions,
      structureBank.questions,
    ],
  );
  const questionBankStatuses = Object.fromEntries(
    allSubjectIds.map((subjectId) => [
      subjectId,
      subjectId === initialSubject
        ? 'ready'
        : requestedSubjects.includes(subjectId)
          ? bankBySubject[subjectId].status
          : 'idle',
    ]),
  ) as Record<SubjectId, NotesQuestionBankStatus>;
  const requestQuestionBank = useCallback(
    (subjectId: SubjectId, year?: number) => {
      if (subjectId === initialSubject) return;
      setRequestedSubjects((current) =>
        current.includes(subjectId) ? current : [...current, subjectId],
      );
      setRequestedYears((current) => {
        const existing = current[subjectId];
        if (year === undefined || existing === null) {
          return existing === null ? current : { ...current, [subjectId]: null };
        }
        if (existing?.includes(year)) return current;
        return { ...current, [subjectId]: [...(existing ?? []), year] };
      });
    },
    [initialSubject],
  );
  function retryQuestionBank(subjectId: SubjectId) {
    bankBySubject[subjectId].retry();
  }

  return (
    <PersonalLayout>
      <NotesPage
        questions={questions}
        questionBankStatuses={questionBankStatuses}
        onRequestQuestionBank={requestQuestionBank}
        onRetryQuestionBank={retryQuestionBank}
      />
    </PersonalLayout>
  );
}
