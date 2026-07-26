import Head from 'next/head';
import { DifficultPage } from '@/features/difficult/difficult-page';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import { useAppState } from '@/state/app-state';

/**
 * Marked questions are user data, so this page has nothing to prerender. It
 * loads only the subjects the user actually marked instead of shipping the
 * whole bank inside the page payload.
 */
export default function DifficultRoute() {
  const { state, hydrated } = useAppState();
  const difficultSubjects = hydrated
    ? subjectsOfQuestionIds(state.difficultQuestionIds)
    : [];
  const lawBank = useSubjectQuestions(
    difficultSubjects.includes('law') ? ['law'] : [],
  );
  const environmentBank = useSubjectQuestions(
    difficultSubjects.includes('env') ? ['env'] : [],
  );
  const constructionBank = useSubjectQuestions(
    difficultSubjects.includes('construction') ? ['construction'] : [],
  );
  const structureBank = useSubjectQuestions(
    difficultSubjects.includes('structure') ? ['structure'] : [],
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
        <title>難題標記｜建築師考試</title>
      </Head>
      <DifficultPage
        questions={banks.flatMap((bank) => bank.questions)}
        questionBankStatuses={{
          law: lawBank.status,
          env: environmentBank.status,
          construction: constructionBank.status,
          structure: structureBank.status,
        }}
        onRetryQuestionBank={(subjectId) =>
          bankBySubject[subjectId].retry()
        }
      />
    </>
  );
}
