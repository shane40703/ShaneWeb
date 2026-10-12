import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { IconArrowRight, IconBook, IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { useAppState } from '@/state/app-state';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { useClientReady } from '@/lib/use-client-ready';
import { CLOZE_STORAGE_KEY, clozeBank, clozeCategories, createClozeSession, gradeCloze, parseClozeSession, type ClozeSession } from './cloze';
import styles from './law-cloze-page.module.css';

export function LawClozePage() {
  const ready = useClientReady();
  const { reportPersistence } = useAppState();
  const [session, setSession] = useState<ClozeSession | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setSession(parseClozeSession(readStoredValue(CLOZE_STORAGE_KEY)) ?? createClozeSession());
    });
    return () => { active = false; };
  }, [ready]);
  useEffect(() => {
    if (session) reportPersistence('law-cloze', writeStoredValue(CLOZE_STORAGE_KEY, JSON.stringify(session)));
  }, [session, reportPersistence]);

  if (!session) return <p role='status'>正在準備法規克漏字…</p>;
  const question = clozeBank.questions.find((q) => q.id === session.order[session.index])!;
  const grades = gradeCloze(question, session.answers);
  const completed = Object.entries(session.results);
  const correctQuestions = completed.filter(([id, answers]) => gradeCloze(clozeBank.questions.find((q) => q.id === id)!, answers).every(Boolean)).length;
  const last = session.index === session.order.length - 1;
  const complete = last && session.submitted;
  const fullArticleUrl = 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=' + question.articleNumber;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || session.submitted || question.blanks.some((_, i) => !session.answers[i]?.trim())) return;
    setSession({ ...session, submitted: true, results: { ...session.results, [question.id]: [...session.answers] } });
  }
  function restart(category = session!.category) {
    setSession(createClozeSession(category));
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro} aria-labelledby='cloze-title'>
        <div className={styles.heading}><IconBook size={25} aria-hidden='true' /><h2 id='cloze-title'>法規克漏字</h2><span>試作版</span></div>
        <p>{clozeBank.lawName}・{clozeBank.questions.length} 個數字題型</p>
        <small>修正：115.02.23 ／ 核對：115.10.12。練習現行已施行條文，不以現行答案回推舊年度試題。</small>
        <div className={styles.controls}>
          <label>練習考點
            <select value={session.category} onChange={(event) => restart(event.target.value)}>
              <option value='全部'>全部考點</option>
              {clozeCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <span>本輪已提交 {completed.length} 題・全對 {correctQuestions} 題</span>
          <Button onClick={() => restart()}><IconRefresh size={16} />重新練習</Button>
        </div>
      </section>

      <form className={styles.card} onSubmit={submit} aria-labelledby='cloze-question-title'>
        <header>
          <div className={styles.tags}><span>{question.category}</span><span>第 {question.articleNumber} 條</span></div>
          <strong>{session.index + 1} / {session.order.length}</strong>
        </header>
        <h3 id='cloze-question-title'>{question.title}</h3>
        <p className={styles.instruction}>填入原文數字；分數、比值、小數及「半」須維持法條的表示方式，不互相換算。例如八分之一可填「八分之一」或「1/8」，不能填「0.125」。</p>
        <div className={styles.passage} aria-label='填空條文節錄'>
          {question.template.split(/(\{\{\d+\}\})/).map((part, i) => {
            const match = part.match(/^\{\{(\d+)\}\}$/);
            return match ? <strong className={styles.blankMark} key={i}>〔{Number(match[1]) + 1}〕</strong> : <span key={i}>{part}</span>;
          })}
        </div>
        <div className={styles.fields}>
          {question.blanks.map((blank, index) => (
            <label key={index} className={styles.field}>
              <span>{index + 1}. {blank.label}</span>
              <div><input
                aria-label={`第 ${index + 1} 空：${blank.label}`}
                autoComplete='off' inputMode={blank.unit === '比例' || blank.unit === '比值' || blank.original.startsWith('半') ? 'text' : 'decimal'}
                required maxLength={50} value={session.answers[index] ?? ''} disabled={session.submitted}
                aria-invalid={session.submitted && !grades[index]}
                onChange={(event) => {
                  const answers = question.blanks.map((_, i) => session.answers[i] ?? '');
                  answers[index] = event.target.value;
                  setSession({ ...session, answers });
                }}
              /><small>{blank.unit}</small></div>
              {session.submitted ? <span className={styles.fieldResult} data-correct={grades[index]}>
                {grades[index] ? <IconCheck size={16} /> : <IconX size={16} />}
                {grades[index] ? '正確' : `正確：${blank.answer}（原文：${blank.original}）`}
              </span> : null}
            </label>
          ))}
        </div>
        <footer>
          {session.submitted ? <>
            <span role='status'>{complete ? '本輪完成・' : ''}本題答對 {grades.filter(Boolean).length} / {grades.length} 空</span>
            <Button variant='primary' onClick={() => {
              if (last) restart();
              else setSession({ ...session, index: session.index + 1, answers: [], submitted: false });
            }}>{last ? '再練一輪' : '下一題'}<IconArrowRight size={17} /></Button>
          </> : <><span>填完全部 {question.blanks.length} 空後提交</span><Button type='submit' variant='primary' disabled={question.blanks.some((_, i) => !session.answers[i]?.trim())}>提交答案</Button></>}
        </footer>
      </form>

      {session.submitted ? <section className={styles.card} aria-labelledby='cloze-law-title'>
        <div className={styles.lawHeading}><h3 id='cloze-law-title'>完整條文・第 {question.articleNumber} 條</h3><a href={fullArticleUrl} target='_blank' rel='noreferrer'>核對官方原文與附圖 ↗</a></div>
        <p className={styles.instruction}>完整顯示本條文字，包含未挖空的條件、但書及其他款項；原始附圖／附表請由官方原文查看。</p>
        <pre className={styles.fullText}>{question.fullText}</pre>
        {question.fullFileUrl ? <a href={question.fullFileUrl} target='_blank' rel='noreferrer'>官方完整條文檔（含附表）↗</a> : null}
        {question.images.map((image, index) => <a href={image.url} key={image.url} target='_blank' rel='noreferrer'>
          <Image src={image.url} width={1100} height={800} unoptimized className={styles.lawImage} alt={`第 ${question.articleNumber} 條官方附圖／附表 ${index + 1}`} />
          開啟官方附圖／附表 {index + 1} ↗
        </a>)}
        <details className={styles.evidence}>
          <summary>題型相關考古題：{question.evidence.length} 題（100～114 年）</summary>
          <p>依人工考點及題幹／選項關鍵字比對，表示相關題型線索，不代表每題直接考同一條；本次填空以現行條文製作。</p>
          <div>{question.evidence.map((item) => <Link href={`/questions/law/${item.year}/${String(item.number).padStart(2, '0')}`} key={item.id}>{item.year} 年・第 {item.number} 題</Link>)}</div>
        </details>
      </section> : null}
      <p className={styles.storageNote}>作答進度與本輪成績保存在目前瀏覽器；切換考點或重新練習會開始新一輪。</p>
    </div>
  );
}
