import { memo, useState } from 'react';
import { IconFileTypePdf, IconListSearch } from '@tabler/icons-react';
import { QuestionPrompt } from '@/components/content/content';
import { Button } from '@/components/ui/ui';
import type { Question } from '@/lib/types';
import type { DailyPracticeSession } from './daily-practice';
import { createDailyPaper } from './daily-paper';
import styles from './daily-paper-panel.module.css';

export const DailyPaperPanel = memo(function DailyPaperPanel({ session, questionById, onRetry }: {
  session: DailyPracticeSession;
  questionById: ReadonlyMap<string, Question>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const ready = session.questionIds.every(id => questionById.has(id));
  const paper = ready ? createDailyPaper(session, questionById) : null;

  async function download() {
    if (!paper || downloading) return;
    setDownloading(true); setError('');
    try {
      // Keep the PDF engine and font off the initial daily-practice download.
      const { downloadDailyPaperPdf } = await import('./daily-paper-pdf');
      await downloadDailyPaperPdf(paper);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF 下載失敗，請稍後再試。');
    } finally { setDownloading(false); }
  }

  return <section className={styles.panel} aria-label="當日試題工具">
    <header>
      <div><strong>當日試題</strong><small>{session.date}・共 {session.questionIds.length} 題{session.mode === 'adventure' ? '（含闖關備用題）' : ''}</small></div>
      <div className={styles.actions}>
        <Button disabled={!ready} aria-expanded={open} aria-controls="daily-paper-preview" onClick={() => setOpen(value => !value)}>
          <IconListSearch size={17} />{open ? '收合當日考題' : '當日考題預覽'}
        </Button>
        <Button disabled={!ready || downloading} onClick={download}>
          <IconFileTypePdf size={17} />{downloading ? '正在製作 PDF…' : '列印／下載 PDF'}
        </Button>
      </div>
    </header>
    <p>題目與選項順序和本次練習一致，PDF 末頁附獨立參考答案。下載後可用 PDF 閱讀器列印手寫。
      {session.mode === 'adventure' && session.status === 'practice' ? ' 闖關計時照常進行。' : ''}</p>
    {!ready ? <p role="status">當日題目尚未完整載入。<Button onClick={onRetry}>重新載入試題</Button></p> : null}
    {error ? <p role="alert">{error} 請重新點選下載；不會影響作答進度。</p> : null}
    {open && paper ? <div id="daily-paper-preview" role="region" aria-label="當日考題預覽" className={styles.preview}>
      <h3>{paper.subjectName}・當日完整考題</h3>
      <p>包含本次所有派發題目；不顯示答案、詳解或筆記。</p>
      <ol>{paper.questions.map((question, index) => <li key={question.id} data-question-id={question.id}>
        <article>
          <header><strong>第 {index + 1} 題</strong><span>{question.year} 年・原題第 {question.questionNumber} 題</span></header>
          <QuestionPrompt question={question} compact />
          <ol className={styles.options} aria-label={`每日第 ${index + 1} 題選項`}>
            {question.options.map((option, i) => <li key={i}><b>({String.fromCharCode(65 + i)})</b><span>{option}</span></li>)}
          </ol>
        </article>
      </li>)}</ol>
    </div> : null}
  </section>;
});
