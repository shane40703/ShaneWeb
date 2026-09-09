import Head from 'next/head';
import { WrongPage } from '@/features/wrong/wrong-page';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { isSubjectId } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';

export default function WrongRoute() {
  const { state, hydrated } = useAppState();
  const yearsFor = (subject: SubjectId) => [
    ...new Set(
      state.attempts.flatMap((attempt) =>
        attempt.subject === subject && typeof attempt.year === 'number'
          ? [attempt.year]
          : [],
      ),
    ),
  ];
  const attemptedSubjects = hydrated
    ? [
        ...new Set(
          state.attempts.flatMap((attempt) =>
            isSubjectId(attempt.subject) ? [attempt.subject] : [],
          ),
        ),
      ]
    : [];
  const lawYears = yearsFor('law');
  const environmentYears = yearsFor('env');
  const constructionYears = yearsFor('construction');
  const structureYears = yearsFor('structure');
  const lawBank = useSubjectQuestions(
    attemptedSubjects.includes('law') ? ['law'] : [],
    lawYears,
  );
  const environmentBank = useSubjectQuestions(
    attemptedSubjects.includes('env') ? ['env'] : [],
    environmentYears,
  );
  const constructionBank = useSubjectQuestions(
    attemptedSubjects.includes('construction') ? ['construction'] : [],
    constructionYears,
  );
  const structureBank = useSubjectQuestions(
    attemptedSubjects.includes('structure') ? ['structure'] : [],
    structureYears,
  );
  const banks = [lawBank, environmentBank, constructionBank, structureBank];
  const bankBySubject = {
    law: lawBank,
    env: environmentBank,
    construction: constructionBank,
    structure: structureBank,
  } as const;

  return (
    <>
      <Head>
        <title>常錯題目｜建築師考試</title>
      </Head>
      <WrongPage
        attempts={state.attempts}
        questions={banks.flatMap((bank) => bank.questions)}
        questionBankStatuses={{
          law: lawBank.status,
          env: environmentBank.status,
          construction: constructionBank.status,
          structure: structureBank.status,
        }}
        onRetryQuestionBank={(subjectId) => bankBySubject[subjectId].retry()}
      />
    </>
  );
}
