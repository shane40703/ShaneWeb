import Head from 'next/head';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { WrongPage } from '@/features/wrong/wrong-page';
import { useSubjectFacets } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import { useAppState } from '@/state/app-state';

export default function WrongRoute() {
  const { state, hydrated } = useAppState();
  // Only answered questions can be wrong. Grading needs facets, and the page loads the bodies
  // of the one paper it shows.
  const answeredIds = state.attempts.flatMap((attempt) => Object.keys(attempt.answers));
  const attemptedSubjects = hydrated ? subjectsOfQuestionIds(answeredIds) : [];
  const lawBank = useSubjectFacets(attemptedSubjects.includes('law') ? ['law'] : []);
  const environmentBank = useSubjectFacets(attemptedSubjects.includes('env') ? ['env'] : []);
  const constructionBank = useSubjectFacets(
    attemptedSubjects.includes('construction') ? ['construction'] : [],
  );
  const structureBank = useSubjectFacets(
    attemptedSubjects.includes('structure') ? ['structure'] : [],
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
