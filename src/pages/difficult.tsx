import Head from 'next/head';
import { DifficultPage } from '@/features/difficult/difficult-page';
import { PersonalLayout } from '@/features/personal/personal-layout';
import {
  useQuestionBodies,
  useSubjectFacets,
  type QuestionBankStatus,
} from '@/lib/question-bank-client';
import { parseQuestionId, subjectsOfQuestionIds } from '@/lib/question-path';
import { useAppState } from '@/state/app-state';

/**
 * Marked questions are user data, so this page has nothing to prerender. It
 * reads the facets of the subjects the user marked, and the page loads the
 * bodies of the one paper it shows.
 */
export default function DifficultRoute() {
  const { state, hydrated } = useAppState();
  const difficultSubjects = hydrated
    ? subjectsOfQuestionIds(state.difficultQuestionIds)
    : [];
  const lawBank = useSubjectFacets(difficultSubjects.includes('law') ? ['law'] : []);
  const environmentBank = useSubjectFacets(difficultSubjects.includes('env') ? ['env'] : []);
  const constructionBank = useSubjectFacets(
    difficultSubjects.includes('construction') ? ['construction'] : [],
  );
  const structureBank = useSubjectFacets(
    difficultSubjects.includes('structure') ? ['structure'] : [],
  );
  const banks = [lawBank, environmentBank, constructionBank, structureBank];
  // Facets are multiple choice only; a written question marked long ago still has its row.
  const writtenIds = hydrated
    ? state.difficultQuestionIds.filter(
        (questionId) => parseQuestionId(questionId)?.format === 'written',
      )
    : [];
  const written = useQuestionBodies(writtenIds);
  const statusOf = (status: QuestionBankStatus) =>
    status === 'ready' ? written.status : status;
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
      <PersonalLayout>
        <DifficultPage
          questions={[
            ...banks.flatMap((bank) => bank.questions),
            ...writtenIds.flatMap((questionId) => written.byId.get(questionId) ?? []),
          ]}
          questionBankStatuses={{
            law: statusOf(lawBank.status),
            env: statusOf(environmentBank.status),
            construction: statusOf(constructionBank.status),
            structure: statusOf(structureBank.status),
          }}
          onRetryQuestionBank={(subjectId) => {
            bankBySubject[subjectId].retry();
            written.retry();
          }}
        />
      </PersonalLayout>
    </>
  );
}
