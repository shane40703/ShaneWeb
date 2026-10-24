import { ExamsPage } from '@/features/exams/exams-page';
import { useSubjectQuestions, type QuestionBankStatus } from '@/lib/question-bank-client';
import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { fixtureSubjectQuestions } from '../../fixtures/questions';

const allSubjectIds = subjects.map((subject) => subject.id);

/** 跟 /exams 的 getStaticProps 一樣，只預先產生第一個科目（法規）的題目，順序跟伺服器一樣。 */
const prerenderedQuestions = fixtureSubjectQuestions(allSubjectIds[0]);

/**
 * 照 src/pages/exams.tsx 組出考古題討論版頁：預先產生的法規題目，加上 useSubjectQuestions
 * 下載的所有科目（Storybook 由範例題庫回應），用題目 id 合併後交給 ExamsPage。
 * 不給 props 時跟網站一樣；`bank` 用來看題庫下載中、下載失敗、完全沒有題目的畫面。
 * 頁面用網址的 ?question= 換題，故事的 decorators 要加 withStatefulRouter。
 */
export function ExamsRoute({
  bank = 'loaded',
  questionOverrides = [],
  onRetryQuestionBank,
}: {
  /** 其他科目題庫的狀態：loaded 跟網站一樣下載；loading／error 模擬下載中、失敗；empty 是完全沒有題目。 */
  bank?: 'loaded' | 'loading' | 'error' | 'empty';
  /** 取代題庫中同 id 的題目，例如加上內建詳解或改成示範題。 */
  questionOverrides?: readonly Question[];
  /** 「題庫載入失敗」的重新載入按鈕（bank 為 loaded 時用網站本身的重試）。 */
  onRetryQuestionBank?: () => void;
}) {
  const loaded = useSubjectQuestions(bank === 'loaded' ? allSubjectIds : []);
  const initialQuestions = bank === 'empty' ? [] : prerenderedQuestions;
  const bankQuestions = bank === 'loaded' ? loaded.questions : [];
  const status: QuestionBankStatus =
    bank === 'loaded' ? loaded.status : bank === 'empty' ? 'ready' : bank;
  const overrides = new Map(questionOverrides.map((question) => [question.id, question]));
  const questions = [
    ...new Map(
      [...initialQuestions, ...bankQuestions].map((question) => [question.id, question]),
    ).values(),
  ].map((question) => overrides.get(question.id) ?? question);

  return (
    <ExamsPage
      questions={questions}
      questionBankStatus={status}
      onRetryQuestionBank={bank === 'loaded' ? loaded.retry : onRetryQuestionBank}
    />
  );
}
