import Head from 'next/head';
import { HistoryPage } from '@/features/history/history-page';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import { useAppState } from '@/state/app-state';

/**
 * Attempts are user data, so this page has nothing to prerender. It loads only
 * the subjects the stored attempts refer to instead of shipping the whole bank
 * inside the page payload.
 */
export default function HistoryRoute() {
  const { state, hydrated } = useAppState();
  const attemptedQuestionIds = state.attempts.flatMap((attempt) => attempt.questionIds);
  const attemptedSubjects = hydrated
    ? subjectsOfQuestionIds(attemptedQuestionIds)
    : [];
  const lawBank = useSubjectQuestions(attemptedSubjects.includes('law') ? ['law'] : []);
  const environmentBank = useSubjectQuestions(
    attemptedSubjects.includes('env') ? ['env'] : [],
  );
  const constructionBank = useSubjectQuestions(
    attemptedSubjects.includes('construction') ? ['construction'] : [],
  );
  const structureBank = useSubjectQuestions(
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
        <title>已作答紀錄｜建築師考試</title>
      </Head>
      <HistoryPage
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
