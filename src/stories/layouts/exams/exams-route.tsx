import { ExamsLayout } from '@/features/exams/exams-layout';
import { ExamsPage } from '@/features/exams/exams-page';
import { useSubjectQuestions, type QuestionBankStatus } from '@/lib/question-bank-client';
import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { buildPaperIndex, questionRefs } from '@/question-bank/derived-data';
import { fixtureQuestions, fixtureSubjectQuestions } from '../../fixtures/questions';

const allSubjectIds = subjects.map((subject) => subject.id);

/** 先有內容的法規題目（網站只預先產生網址裡那一題；故事直接給整科，順序跟伺服器一樣）。 */
const prerenderedQuestions = fixtureSubjectQuestions(allSubjectIds[0]);

/** 跟網站的試卷索引一樣：一開始就知道每一份試卷有哪些題號，題目內容之後才下載。 */
const fixtureRefs = questionRefs(buildPaperIndex(fixtureQuestions));

/**
 * 照 src/pages/exams/[[...slug]].tsx 組出歷屆試題（討論版）頁：外面是 ExamsLayout（不畫「返回」，
 * 只負責上一頁、下一頁的捲動位置，並記住側欄要回到的位置），
 * 範例題庫的每一題先只有題號，預先產生的法規題目與 useSubjectQuestions 下載的所有科目
 * （Storybook 由範例題庫回應）有內容，用題目 id 合併後交給 ExamsPage。
 * 不給 props 時跟網站一樣；`bank` 用來看題庫下載中、下載失敗、完全沒有題目的畫面。
 * 頁面用網址的 slug 換頁，故事的 decorators 要加 withStatefulRouter。
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
  /** 題目卡片「題目暫時無法顯示」的重新載入按鈕（bank 為 loaded 時用網站本身的重試）。 */
  onRetryQuestionBank?: () => void;
}) {
  const loaded = useSubjectQuestions(bank === 'loaded' ? allSubjectIds : []);
  const bankQuestions = bank === 'loaded' ? loaded.questions : [];
  const status: QuestionBankStatus =
    bank === 'loaded' ? loaded.status : bank === 'empty' ? 'ready' : bank;
  const overrides = new Map(questionOverrides.map((question) => [question.id, question]));
  const bodies = new Map(
    [...prerenderedQuestions, ...bankQuestions].map((question) => [
      question.id,
      overrides.get(question.id) ?? question,
    ]),
  );
  const questions =
    bank === 'empty' ? [] : fixtureRefs.map((ref) => bodies.get(ref.id) ?? ref);

  return (
    <ExamsLayout>
      <ExamsPage
        questions={questions}
        questionBankStatus={status}
        onRetryQuestionBank={bank === 'loaded' ? loaded.retry : onRetryQuestionBank}
      />
    </ExamsLayout>
  );
}
