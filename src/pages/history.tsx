import Head from 'next/head';
import { HistoryPage } from '@/features/history/history-page';
import { selectHistoryAttempts } from '@/features/history/history-attempts';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { useSubjectFacets } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import { useAppState } from '@/state/app-state';

/**
 * Attempts are user data, so this page has nothing to prerender. Rows are collapsed and their
 * counts come from facets; a body downloads only when a row is opened.
 */
export default function HistoryRoute({ dailyOnly = false }: { dailyOnly?: boolean }) {
  const { state, hydrated } = useAppState();
  const attempts = selectHistoryAttempts(state.attempts, dailyOnly);
  const attemptedQuestionIds = attempts.flatMap((attempt) => attempt.questionIds);
  const attemptedSubjects = hydrated
    ? subjectsOfQuestionIds(attemptedQuestionIds)
    : [];
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
        <title>{dailyOnly ? '每日練習履歷' : '歷屆試題作答履歷'}｜建築師考試</title>
      </Head>
      <PersonalLayout>
        <HistoryPage
          dailyOnly={dailyOnly}
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
      </PersonalLayout>
    </>
  );
}
