import Head from 'next/head';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { WrongPage } from '@/features/wrong/wrong-page';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { parseQuestionId, subjectsOfQuestionIds } from '@/lib/question-path';
import type { SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';

export default function WrongRoute() {
  const { state, hydrated } = useAppState();
  // Only answered questions can be wrong. 每日抽題練習 records span many years, so the
  // years come from the questions themselves rather than from the record.
  const answeredIds = state.attempts.flatMap((attempt) => Object.keys(attempt.answers));
  const yearsFor = (subject: SubjectId) => [
    ...new Set(
      answeredIds.flatMap((questionId) => {
        const parsed = parseQuestionId(questionId);
        return parsed?.subject === subject ? [parsed.year] : [];
      }),
    ),
  ];
  const attemptedSubjects = hydrated ? subjectsOfQuestionIds(answeredIds) : [];
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
      <PersonalLayout>
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
      </PersonalLayout>
    </>
  );
}
