import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { useCallback, useMemo, useState } from 'react';
import {
  NotesPage,
  type NotesQuestionBankStatus,
} from '@/features/notes/notes-page';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { subjects } from '@/question-bank/catalog';
import type { Question, SubjectId } from '@/lib/types';

const allSubjectIds = subjects.map((subject) => subject.id);

/**
 * The first subject is prerendered for the initial editor. Other subjects are
 * requested only after a deep link, saved-note click, or explicit subject
 * switch, so opening the page does not download the whole bank.
 */
export const getStaticProps: GetStaticProps<{
  initialQuestions: Question[];
}> = async () => ({
  props: { initialQuestions: await loadSubjectQuestions(allSubjectIds[0]) },
});

export default function NotesRoute({
  initialQuestions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const initialSubject = initialQuestions[0]?.subject ?? allSubjectIds[0];
  const [requestedSubjects, setRequestedSubjects] = useState<SubjectId[]>([]);
  const shouldLoad = (subjectId: SubjectId) =>
    subjectId !== initialSubject && requestedSubjects.includes(subjectId);

  const lawBank = useSubjectQuestions(shouldLoad('law') ? ['law'] : []);
  const environmentBank = useSubjectQuestions(shouldLoad('env') ? ['env'] : []);
  const constructionBank = useSubjectQuestions(
    shouldLoad('construction') ? ['construction'] : [],
  );
  const structureBank = useSubjectQuestions(
    shouldLoad('structure') ? ['structure'] : [],
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
  const requestQuestionBank = useCallback((subjectId: SubjectId) => {
    if (subjectId === initialSubject) return;
    setRequestedSubjects((current) =>
      current.includes(subjectId) ? current : [...current, subjectId],
    );
  }, [initialSubject]);
  function retryQuestionBank(subjectId: SubjectId) {
    bankBySubject[subjectId].retry();
  }

  return (
    <>
      <Head>
        <title>使用者筆記｜建築師考試</title>
      </Head>
      <NotesPage
        questions={questions}
        questionBankStatuses={questionBankStatuses}
        onRequestQuestionBank={requestQuestionBank}
        onRetryQuestionBank={retryQuestionBank}
      />
    </>
  );
}
