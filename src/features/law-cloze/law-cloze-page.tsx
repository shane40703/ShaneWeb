import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { IconArrowRight, IconBook, IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { useAppState } from '@/state/app-state';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { useClientReady } from '@/lib/use-client-ready';
import { CLOZE_COUNTS, CLOZE_STORAGE_KEY, clozeBank, getClozeCategories, getClozePool, getFullArticleParts, createClozeSession, gradeCloze, parseClozeSession, revealClozeAnswer, type ClozeOptions, type ClozeQuestion, type ClozeSession } from './cloze';
import styles from './law-cloze-page.module.css';

type ClozeEvidence = ClozeQuestion['evidence'][number];
// Related past questions open in 歷屆試題, which shows the question with its answer.
const examQuestionHref = (item: ClozeEvidence) => `/exams?question=${item.id}`;

export function LawClozePage() {
  const ready = useClientReady();
  const { reportPersistence } = useAppState();
  const [session, setSession] = useState<ClozeSession | null>(null);
  const [options, setOptions] = useState<ClozeOptions>({ lawId: '全部', category: '全部', count: 10 });
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const restored = parseClozeSession(readStoredValue(CLOZE_STORAGE_KEY)) ?? createClozeSession();
      setSession(restored);
      setOptions({ lawId: restored.lawId, category: restored.category, count: restored.count });
    });
    return () => { active = false; };
  }, [ready]);
  useEffect(() => {
    if (session) reportPersistence('law-cloze', writeStoredValue(CLOZE_STORAGE_KEY, JSON.stringify(session)));
  }, [session, reportPersistence]);

  if (!session) return <p role='status'>正在準備法規克漏字…</p>;
  const question = clozeBank.questions.find((q) => q.id === session.order[session.index])!;
  const law = clozeBank.laws.find((law) => law.id === question.lawId)!;
  const grades = gradeCloze(question, session.answers);
  const completed = Object.entries(session.results);
  const resultGrades = completed.map(([id, answers]) => gradeCloze(clozeBank.questions.find((q) => q.id === id)!, answers));
  const correctQuestions = resultGrades.filter((result) => result.every(Boolean)).length;
  const correctBlanks = resultGrades.flat().filter(Boolean).length;
  const totalBlanks = resultGrades.flat().length;
  const last = session.index === session.order.length - 1;
  const revealed = session.revealed.includes(question.id);
  const resolved = session.submitted || revealed;
  const complete = last && resolved;
  const poolSize = getClozePool(options).length;
  const changed = options.lawId !== session.lawId || options.category !== session.category || options.count !== session.count;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || resolved || question.blanks.some((_, i) => !session.answers[i]?.trim())) return;
    setSession({ ...session, submitted: true, results: { ...session.results, [question.id]: [...session.answers] } });
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro} aria-labelledby='cloze-title'>
        <div className={styles.heading}><IconBook size={25} aria-hidden='true' /><h2 id='cloze-title'>法規克漏字</h2><span>數字填空</span></div>
        <p>{clozeBank.laws.length} 部法規・{clozeBank.questions.length} 個數字題型。直接在條文空格中填答，每次隨機抽題、不重複。</p>
        <details className={styles.sources}>
          <summary>法規版本與官方來源</summary>
          {clozeBank.laws.map((law) => <p key={law.id}><a href={law.sourceUrl} target='_blank' rel='noreferrer'>{law.name} ↗</a><br />{law.note} 核對：{law.verifiedOn}。</p>)}
          <p>練習現行規定；不以現行答案回推舊年度試題。</p>
        </details>
        <div className={styles.controls}>
          <label>法規<select value={options.lawId} onChange={(event) => setOptions({ ...options, lawId: event.target.value, category: '全部' })}>
            <option value='全部'>全部法規</option>
            {clozeBank.laws.map((law) => <option key={law.id} value={law.id}>{law.name}</option>)}
          </select></label>
          <label>考點<select value={options.category} onChange={(event) => setOptions({ ...options, category: event.target.value })}>
            <option value='全部'>隨機考點（全部）</option>
            {getClozeCategories(options.lawId).map((category) => <option key={category} value={category}>{category}</option>)}
          </select></label>
          <label>每次測驗題數<select value={options.count} onChange={(event) => setOptions({ ...options, count: Number(event.target.value) })}>
            {CLOZE_COUNTS.map((count) => <option key={count} value={count}>{count} 題</option>)}
          </select></label>
          <Button onClick={() => setSession(createClozeSession(options))} disabled={!poolSize}><IconRefresh size={16} />開始新測驗</Button>
        </div>
        <p className={styles.instruction}>可用題型 {poolSize} 題；新測驗將抽 {Math.min(options.count, poolSize)} 題。{poolSize < options.count ? '此考點題數不足，使用全部可用題型，不重複湊題。' : ''} 設定調整後按「開始新測驗」才會取代目前進度。{changed ? '（有尚未套用的設定）' : ''}</p>
        {session.version !== clozeBank.version ? <p className={styles.instruction} role='note'>題庫已擴充，保留先前的 {session.order.length} 題順序、草稿與成績；按「開始新測驗」即可抽取擴充後的題庫。</p> : null}
        <div className={styles.score}>本輪已提交 {completed.length} / {session.order.length} 題・全對 {correctQuestions} 題・答對 {correctBlanks} / {totalBlanks} 空{session.revealed.length ? `・直接看答案 ${session.revealed.length} 題（不計分）` : ''}</div>
      </section>

      {complete ? <section className={styles.summary} aria-labelledby='cloze-summary-title'>
        <h3 id='cloze-summary-title'>本輪測驗完成</h3>
        <p>{completed.length} 題中 {correctQuestions} 題全對；{totalBlanks ? `${totalBlanks} 空中答對 ${correctBlanks} 空（${Math.round(correctBlanks / totalBlanks * 100)}%）。` : '本輪未提交作答，不計答對率。'}{session.revealed.length ? `另 ${session.revealed.length} 題直接看答案，不納入成績。` : ''}</p>
        <ol>{session.order.map((id) => {
          const item = clozeBank.questions.find((q) => q.id === id)!;
          if (session.revealed.includes(id)) return <li key={id}>{item.title}<span>直接看答案・不計分</span></li>;
          const result = gradeCloze(item, session.results[id]);
          return <li key={id}>{item.title}<span>{result.filter(Boolean).length} / {result.length} 空</span></li>;
        })}</ol>
      </section> : null}

      <form className={styles.card} onSubmit={submit} aria-labelledby='cloze-question-title'>
        <header><div className={styles.tags}><span>{question.category}</span><span>{question.articleLabel}</span></div><strong>{session.index + 1} / {session.order.length}</strong></header>
        <p className={styles.lawName}>{law.name}</p>
        <h3 id='cloze-question-title'>{question.title}</h3>
        <p className={styles.instruction}>直接填入原文數字；分數、比值、小數及「半」須維持法條表示方式，不互相換算。例如八分之一可填「八分之一」或「1/8」，不能填「0.125」。相同空號會同步填答。</p>
        {revealed ? <p className={styles.instruction}>本題為閱讀練習，紅字顯示原文答案；草稿保留，但本題不計分。重新填答請開始新測驗。</p> : null}
        <p className={styles.instruction}>下方完整呈現本題所屬條文，保留所有項、款、前提與但書；只在本題考點數字挖空。規範題呈現所涉編號的完整文字。</p>
        <div className={styles.passage} aria-label='填空完整條文'>
          {getFullArticleParts(question).map((part, i) => {
            if (!part.isAnswer) return <span key={i}>{part.text}</span>;
            const index = part.blankIndex!;
            const blank = question.blanks[index];
            return <span className={styles.inlineBlank} key={i}>
              <sup aria-hidden='true'>〔{index + 1}〕</sup>{revealed ? <strong className={styles.answerText} aria-label={`第 ${index + 1} 空答案：${blank.original}`}>{blank.original}</strong> : <input
                aria-label={`第 ${index + 1} 空：${blank.label}`}
                aria-describedby={session.submitted ? `cloze-result-${index}` : undefined}
                title={blank.label + (blank.unit ? '（' + blank.unit + '）' : '')}
                autoComplete='off' spellCheck={false}
                inputMode={blank.unit === '比例' || blank.unit === '比值' || blank.original === '半' ? 'text' : 'decimal'}
                required maxLength={50} value={session.answers[index] ?? ''} disabled={session.submitted}
                style={{ width: Math.max(4, Math.min(10, (session.answers[index]?.length ?? 0) + 1)) + 'ch' }}
                aria-invalid={session.submitted && !grades[index]} data-correct={session.submitted ? grades[index] : undefined}
                onChange={(event) => {
                  const answers = question.blanks.map((_, i) => session.answers[i] ?? '');
                  answers[index] = event.target.value;
                  setSession({ ...session, answers });
                }}
              />}
            </span>;
          })}
        </div>
        {session.submitted ? <ol className={styles.results} aria-label='逐空比對結果'>
          {question.blanks.map((blank, index) => <li id={`cloze-result-${index}`} key={index} data-correct={grades[index]}>
            {grades[index] ? <IconCheck size={16} aria-hidden='true' /> : <IconX size={16} aria-hidden='true' />}
            <span>{index + 1}. {blank.label}：{grades[index] ? '正確' : '錯誤'}<br /><strong>正確：{blank.answer}{blank.unit && !['比例', '比值'].includes(blank.unit) ? ' ' + blank.unit : ''}（原文：{blank.original}）</strong></span>
          </li>)}
        </ol> : null}
        <footer>
          {resolved ? <>
            <span role='status'>{complete ? '本輪完成・' : ''}{revealed ? '直接看答案・本題不計分' : `本題答對 ${grades.filter(Boolean).length} / ${grades.length} 空`}</span>
            <Button type='button' variant='primary' onClick={() => {
              if (last) setSession(createClozeSession({ lawId: session.lawId, category: session.category, count: session.count }));
              else setSession({ ...session, index: session.index + 1, answers: [], submitted: false });
            }}>{last ? '再練一輪' : '下一題'}<IconArrowRight size={17} /></Button>
          </> : <><span>填完全部 {question.blanks.length} 空後提交；直接看答案不計分。</span><div className={styles.answerActions}><Button type='button' onClick={() => setSession(revealClozeAnswer(session))}>直接看答案</Button><Button type='submit' variant='primary' disabled={question.blanks.some((_, i) => !session.answers[i]?.trim())}>提交答案</Button></div></>}
        </footer>
      </form>

      {resolved ? <section className={styles.card} aria-labelledby='cloze-law-title'>
        <div className={styles.lawHeading}><h3 id='cloze-law-title'>完整{question.lawId === 'accessibility' ? '規範' : ''}條文・{question.articleLabel}</h3><a href={question.sourceUrl} target='_blank' rel='noreferrer'>核對官方原文與附圖 ↗</a></div>
        <p className={styles.instruction}>紅字為本題填空的原文答案；保留未挖空的條件、但書及款次。無障礙規範顯示題目涉及之各編號完整文字；附圖仍屬規定的一部分，請由官方 PDF 核對。</p>
        {question.evidenceKind === 'extension' ? <p className={styles.instruction}>本題為相關考點的條文延伸練習，下面連結僅供題型參考，不代表考古題直接考過本題數字。</p> : null}
        <pre className={styles.fullText}>{getFullArticleParts(question).map((part, index) => part.isAnswer ? <strong className={styles.answerText} key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>)}</pre>
        {question.fullFileUrl ? <a href={question.fullFileUrl} target='_blank' rel='noreferrer'>官方完整法源（含附圖／附表）↗</a> : null}
        {question.images.map((image, index) => <a href={image.url} key={image.url} target='_blank' rel='noreferrer'>
          <Image src={image.url} width={1100} height={800} unoptimized className={styles.lawImage} alt={`${question.articleLabel} 官方附圖／附表 ${index + 1}`} />
          開啟官方附圖／附表 {index + 1} ↗
        </a>)}
        <details className={styles.evidence}>
          <summary>題型相關考古題：{question.evidence.length} 題（100～114 年）</summary>
          <p>依人工考點及題幹／選項關鍵字比對，表示相關題型線索，不代表每題直接考同一條；本次填空以現行條文製作。</p>
          <div>{question.evidence.map((item) => <Link href={examQuestionHref(item)} key={item.id}>{item.year} 年・第 {item.number} 題</Link>)}</div>
        </details>
      </section> : null}
      <p className={styles.storageNote}>本輪抽題順序、設定、草稿與成績保存在目前瀏覽器，不同步雲端；開始新測驗或再練一輪會重新抽題。</p>
    </div>
  );
}
