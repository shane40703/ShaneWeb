import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconCircleCheck,
  IconClock,
  IconEraser,
  IconFlag3,
  IconHeart,
  IconLoader2,
  IconLock,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconSparkles,
  IconSwords,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { DifficultButton } from '@/components/difficult-button';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { AttachmentGallery } from '@/components/image-attachments';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { RichText } from '@/components/rich-text';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { Button, OptionGroup } from '@/components/ui/ui';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import {
  formatCorrectAnswer,
  getAcceptedAnswerIndexes,
  isQuestionCorrect,
} from '@/lib/study';
import { useSharedDiscussions } from '@/lib/shared-discussions';
import { useClientReady } from '@/lib/use-client-ready';
import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  applyDailyOptionOrder,
  activateDailyGuard,
  answerDailyQuestion,
  advanceDailyQuestion,
  finishDailyStageReview,
  startDailyQuestion,
  pauseDailyQuestion,
  settleDailyHealth,
  createDailyCompletionResult,
  createDailyPracticeSession,
  DAILY_BARRIER_SECONDS,
  DAILY_COMPLETION_STORAGE_KEY,
  DAILY_COMBO_STREAK,
  DAILY_PRACTICE_STORAGE_KEY,
  DAILY_QUESTION_SECONDS,
  DAILY_RELIC_TYPES,
  DAILY_STAGES,
  DAILY_CORRECT_HEAL,
  DAILY_MAX_HP,
  DAILY_HP_DRAIN_PER_SECOND,
  DAILY_MAX_RUN_QUESTIONS,
  DAILY_WRONG_DAMAGE,
  getDailyHealth,
  getDailyRunState,
  getDailyStageTheme,
  getDailyCombatState,
  getDailyRelicInventory,
  getDailyRemainingTimeMs,
  getTaipeiDateKey,
  getMillisecondsUntilTaipeiMidnight,
  parseDailyCompletionRecord,
  parseDailyPracticeSession,
  type DailyMode,
  type DailyCompletionRecord,
  type DailyCompletionResult,
  type DailyPracticeSession,
  type DailyRelicType,
} from './daily-practice';
import styles from './daily-page.module.css';

const relicLabels: Record<DailyRelicType, { name: string; description: string }> = {
  eliminate: { name: '破除', description: '自動刪除一個錯誤選項' },
  barrier: {
    name: '結界',
    description: `發動 ${DAILY_BARRIER_SECONDS} 秒防護罩，擋下魔王攻擊並延長倒數`,
  },
};

function RelicIcon({ type, size = 17 }: { type: DailyRelicType; size?: number }) {
  if (type === 'eliminate') return <IconEraser size={size} />;
  return <IconShieldCheck size={size} />;
}

function DailyRelicDock({ session, inventory, disabled, onActivate }: {
  session: DailyPracticeSession;
  inventory: Record<DailyRelicType, number>;
  disabled: boolean;
  onActivate: (type: DailyRelicType) => void;
}) {
  const use = session.relicUses[session.questionIds[session.currentIndex]];
  return (
    <section className={styles.relicDock} aria-label="本題寶具">
      <div><span>RELIC DECK</span><small>{use ? `本題已使用：${relicLabels[use].name}` : '每題最多使用 1 個寶具'}</small></div>
      {DAILY_RELIC_TYPES.map(type => (
        <button key={type} type="button" title={relicLabels[type].description}
          aria-label={`${relicLabels[type].name}：${relicLabels[type].description}，持有 ${inventory[type]} 個`}
          aria-pressed={use === type} disabled={disabled || Boolean(use) || inventory[type] <= 0}
          onClick={() => onActivate(type)}>
          <RelicIcon type={type} /><span>{relicLabels[type].name}</span><b>×{inventory[type]}</b>
        </button>
      ))}
    </section>
  );
}

function subjectShortName(subjectId: SubjectId | undefined) {
  return subjects.find((subject) => subject.id === subjectId)?.shortName ?? '';
}

function removeStoredSession() {
  try {
    window.localStorage.removeItem(DAILY_PRACTICE_STORAGE_KEY);
  } catch {
    // The in-memory reset still works when private browsing blocks storage.
  }
}

function DailyExplanation({
  question,
  selectedIndex,
}: {
  question: Question;
  selectedIndex: number;
}) {
  const shared = useSharedDiscussions(question.id);
  const usefulPosts = shared.posts.filter((post) =>
    ['explanation', 'supplement', 'correction'].includes(post.type),
  );
  const hasBuiltInExplanation = Boolean(question.explanation?.trim());

  return (
    <section className={styles.explanation} aria-label={`第 ${question.questionNumber} 題詳解`}>
      <strong>正確答案：{formatCorrectAnswer(question)}</strong>
      {hasBuiltInExplanation ? (
        <p><RichText>{question.explanation!}</RichText></p>
      ) : null}
      {usefulPosts.map((post) => (
        <article key={post.id}>
          {post.content ? <p><RichText>{post.content}</RichText></p> : null}
          <AttachmentGallery images={post.images} />
        </article>
      ))}
      {shared.loading ? <p>正在載入詳解與討論…</p> : null}
      {!shared.loading && !hasBuiltInExplanation && !usefulPosts.length ? (
        <p>{shared.error || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
      ) : null}
      <span className={styles.answerSummary}>
        {selectedIndex >= 0
          ? `你的答案：${String.fromCharCode(65 + selectedIndex)}`
          : '你的答案：未作答'}
      </span>
    </section>
  );
}

function DailyBattleScene({
  session,
  stageIndex,
  remainingTimeMs,
  barrierActive,
  answer,
  nowMs,
  onGuard,
}: {
  session: DailyPracticeSession;
  stageIndex: number;
  remainingTimeMs: number;
  barrierActive: boolean;
  answer: DailyPracticeSession['answers'][string] | undefined;
  nowMs: number;
  onGuard: () => void;
}) {
  const combat = getDailyCombatState(session, nowMs);
  const run = getDailyRunState(session);
  const stage = getDailyStageTheme(session.subjects[0], stageIndex);
  const answered = run.stages[stageIndex].answered;
  const hp = Math.ceil(getDailyHealth(session, nowMs));
  const victory = session.status === 'completed';
  const failed = session.status === 'failed';
  const protectedHit = Boolean(answer && !answer.correct &&
    session.protectedWrongIds.includes(session.questionIds[
      failed ? Math.max(0, session.currentIndex - 1) : session.currentIndex
    ]));
  const bossRemaining = run.bossRemaining;
  const defeated = bossRemaining === 0 && session.status !== 'failed';
  const remainingSeconds = Math.ceil(remainingTimeMs / 1000);
  const timerProgress = Math.min(
    100,
    (remainingTimeMs / (DAILY_QUESTION_SECONDS * 1000)) * 100,
  );

  return (
    <section
      className={styles.battleScene}
      data-stage={stageIndex + 1}
      data-result={answer ? (answer.correct ? 'correct' : 'wrong') : undefined}
      data-barrier={barrierActive || undefined}
      data-defeated={defeated || undefined}
      data-victory={victory || undefined}
      data-failed={failed || undefined}
      data-blocked={protectedHit || undefined}
      data-enraged={combat.enraged || undefined}
      data-casting={combat.active && !combat.guarding || undefined}
      data-striking={combat.active && !combat.guarding && combat.castProgress >= .88 || undefined}
      data-finisher={answer?.correct && combat.chain > 0 && combat.chain % DAILY_COMBO_STREAK === 0 || undefined}
      style={{ '--cast-duration': `${combat.cycleMs}ms` } as CSSProperties}
      aria-label={`第 ${stageIndex + 1} 層 ${stage.name}，對戰${stage.boss}`}
    >
      <header className={styles.battleHeading}>
        <span>STAGE {stageIndex + 1} / {DAILY_STAGES.length}</span>
        <strong>{stage.name}</strong>
        <small>{stageIndex === DAILY_STAGES.length - 1 ? 'FINAL BOSS' : 'BOSS BATTLE'}</small>
      </header>
      <div className={styles.pixelArena}>
        <span className={styles.scanlines} aria-hidden="true" />
        <div className={styles.heroActor} aria-label="建築師勇者">
          {barrierActive || combat.guarding ? <i className={styles.barrierAura} /> : null}
        </div>
        {answer?.correct && !failed ? (
          <>
            <b className={styles.hitCallout}>MEASURE HIT!</b>
            <span className={styles.bossImpact} aria-hidden="true">✦</span>
            <b className={styles.bossDamage} aria-hidden="true">−1</b>
            <span className={styles.tapeStrike} aria-hidden="true" />
            {combat.chain > 0 && combat.chain % DAILY_COMBO_STREAK === 0 ? (
              <span className={styles.finisherStrike} aria-hidden="true">✦</span>
            ) : null}
          </>
        ) : null}
        {answer && !answer.correct ? (
          <>
            {!failed ? <b className={styles.damageCallout}>{protectedHit ? 'BLOCK!' : 'COUNTER!'}</b> : null}
            <span className={styles.heroImpact} aria-hidden="true">{protectedHit ? '◇' : '✦'}</span>
            <b className={styles.heroDamage} aria-hidden="true">{protectedHit ? '防禦' : failed ? 'KO' : `−${DAILY_WRONG_DAMAGE} HP`}</b>
            <span className={styles.counterStrike} aria-hidden="true" />
          </>
        ) : null}
        {combat.chain >= 2 ? (
          <b className={styles.comboCallout}>{combat.chain} COMBO!{combat.chain % 3 === 0 ? '・連擊必殺' : ''}</b>
        ) : null}
        {combat.active && !combat.guarding && combat.castProgress >= .88 ? (
          <span key={combat.attackNumber} className={styles.enemyBolt} aria-hidden="true" />
        ) : null}
        <div className={styles.bossActor} data-boss={stageIndex + 1} aria-label={stage.boss}>
          <span className={styles.bossSprite} aria-hidden="true"
            style={{ backgroundImage: `url('${stage.sprite}')`, transform: `scaleX(${stage.facing})` }} />
        </div>
        {defeated && !victory ? (
          <strong className={styles.defeatBanner} role="status">魔王擊破！</strong>
        ) : null}
        {victory ? (
          <div className={styles.victoryScene} role="status" aria-label="六層挑戰勝利">
            <span className={styles.victoryStars} aria-hidden="true">✦ ✧ ✦ ✧ ✦</span>
            <IconTrophy size={32} aria-hidden="true" />
            <strong>VICTORY!</strong>
            <span>六層制霸・{stage.boss}擊破</span>
          </div>
        ) : null}
        {failed ? (
          <div className={styles.failureScene} role="status" aria-label="每日挑戰戰敗">
            <strong>DEFEAT</strong>
            <span>{session.failureReason === 'questions' ? '題庫不足，本次挑戰結束' : session.failureReason === 'time'
              ? '時間耗盡，遭魔王擊倒' : session.failureReason === 'mistakes'
                ? '達到本層錯題上限，遭魔王擊倒' : '累積血量耗盡，建築師倒下了'}</span>
          </div>
        ) : null}
      </div>
      <footer className={styles.battleMeters}>
        <div
          className={styles.fighterMeter}
          data-danger={hp <= 25 || undefined}
          aria-label={`建築師剩餘 ${hp} / ${DAILY_MAX_HP} 點血量`}
        >
          <span><b>建築師</b><small>HP {hp} / {DAILY_MAX_HP}・錯 {run.stages[stageIndex].wrong}/{stage.wrongLimit}</small></span>
          <i role="progressbar" aria-label="累積血量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(combat.timedHpRatio * 100)}>
            <b style={{ width: `${combat.timedHpRatio * 100}%` }} />
          </i>
        </div>
        {session.status === 'practice' && !answer ? (
          <div
            className={styles.battleTimer}
            data-danger={remainingSeconds <= 10 || undefined}
            data-barrier={barrierActive || undefined}
            role="timer"
            aria-label={`本題剩餘 ${remainingSeconds} 秒`}
          >
            {barrierActive ? <IconShieldCheck size={18} /> : <IconClock size={18} />}
            <strong>{remainingSeconds}s</strong>
            <i style={{ '--timer-progress': `${timerProgress}%` } as CSSProperties} />
          </div>
        ) : (
          <div className={styles.turnCounter}>TURN {answered}</div>
        )}
        <div
          className={styles.fighterMeter}
          data-boss-meter
          aria-label={`${stage.boss}剩餘 ${bossRemaining} / ${stage.questions} 點血量`}
        >
          <span><b>{stage.boss}</b><small>HP {bossRemaining} / {stage.questions}</small></span>
          <i><b style={{ width: `${(bossRemaining / stage.questions) * 100}%` }} /></i>
        </div>
      </footer>
      <div className={styles.bossIntent} data-danger={combat.active && combat.castProgress >= .65 || undefined}>
        <div>
          <strong>{failed ? '魔王擊倒了建築師' : victory ? '六層制霸！' : answer ? '本題攻防已結算' :
            combat.guarding ? '防護中・敵人攻擊已擋下' : `${combat.enraged ? '狂暴・' : ''}${combat.skill}蓄力`}</strong>
          <small>{combat.active
            ? `血量每秒 −0.5・${Math.ceil((1 - combat.castProgress) * combat.cycleMs / 1000)} 秒後攻擊`
            : '答對魔王 −1／玩家 +15 HP・連對三題獲得寶具'}</small>
          <i><b style={{ width: `${combat.active ? combat.castProgress * 100 : 0}%` }} /></i>
        </div>
        <button type="button" onClick={onGuard} disabled={!combat.guardAvailable}
          aria-label="架設防禦：每關一次，蓄力亮紅時完美格擋">
          <IconShieldCheck size={16} /> {combat.active ? combat.guardAvailable ? '架設防禦' : '防禦已用' : '攻防結束'}
        </button>
      </div>
      {session.guardUses?.[session.questionIds[session.currentIndex]] && combat.active ? (
        <span className={styles.guardResult} role="status">
          {session.guardUses[session.questionIds[session.currentIndex]] === 'perfect'
            ? '完美格擋！延長 5 秒，防護 3 秒'
            : '提前防禦・延長 2 秒，下關可再次使用'}
        </span>
      ) : null}
    </section>
  );
}

function DailyStageTransition({ nextSession, onComplete }: {
  nextSession: DailyPracticeSession;
  onComplete: () => void;
}) {
  const stageIndex = getDailyRunState(nextSession).stageIndex;
  const stage = getDailyStageTheme(nextSession.subjects[0], stageIndex);
  const hp = Math.ceil(nextSession.hp ?? DAILY_MAX_HP);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onComplete, reduced ? 300 : 1800);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <section className={`${styles.battleScene} ${styles.stageTransition}`} data-stage={stageIndex + 1} aria-label="換層過場">
      <header className={styles.battleHeading}>
        <span>STAGE {stageIndex + 1} / {DAILY_STAGES.length}</span>
        <strong>{stage.name}</strong>
        <small>NEXT STAGE</small>
      </header>
      <div className={styles.pixelArena}>
        <h3 className={styles.transitionCaption}><span role="status">前往第 {stageIndex + 1} 層・{stage.name}</span></h3>
        <span className={`${styles.heroActor} ${styles.transitionArchitect}`} aria-hidden="true" />
        <span className={`${styles.bossActor} ${styles.transitionBoss}`} data-boss={stageIndex + 1} aria-hidden="true">
          <span className={styles.bossSprite} style={{ backgroundImage: `url('${stage.sprite}')` }} />
        </span>
      </div>
      <footer className={styles.battleMeters}>
        <div className={styles.fighterMeter}>
          <span><b>建築師</b><small>HP {hp} / {DAILY_MAX_HP}</small></span>
          <i><b style={{ width: `${hp}%` }} /></i>
        </div>
        <div className={styles.turnCounter}>換層中</div>
        <div className={styles.fighterMeter} data-boss-meter>
          <span><b>{stage.boss}</b><small>HP {stage.questions} / {stage.questions}</small></span>
          <i><b style={{ width: '100%' }} /></i>
        </div>
      </footer>
      <div className={styles.bossIntent}>
        <div><strong>前一層已完成</strong><small>保留目前 HP・過場不扣血、不倒數</small></div>
        <button type="button" onClick={onComplete}>略過過場</button>
      </div>
    </section>
  );
}

function DailySetup({
  mode,
  onModeChange,
  selectedSubjects,
  completionResults,
  onToggleSubject,
  onStart,
  questions,
  loading,
  loadFailed,
  onRetry,
}: {
  mode: DailyMode;
  onModeChange: (mode: DailyMode) => void;
  selectedSubjects: SubjectId[];
  completionResults: DailyCompletionRecord['results'];
  onToggleSubject: (subject: SubjectId) => void;
  onStart: () => void;
  questions: Question[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
}) {
  const subjectCounts = Object.fromEntries(
    selectedSubjects.map((subject) => [
      subject,
      questions.filter((question) => question.subject === subject && question.answerKey.kind !== 'written').length,
    ]),
  ) as Partial<Record<SubjectId, number>>;
  const readyToStart = selectedSubjects.every(
    (subject) => (subjectCounts[subject] ?? 0) >= (mode === 'adventure' ? DAILY_MAX_RUN_QUESTIONS : 1),
  );
  const selectedSubject = selectedSubjects[0];

  return (
    <section className={styles.setup} aria-label="每日練習設定">
      <fieldset className={styles.modeChoices}>
        <legend>選擇進行方式</legend>
        <label data-checked={mode === 'normal' || undefined}>
          <input type="radio" name="daily-mode" checked={mode === 'normal'} onChange={() => onModeChange('normal')} />
          <span><strong>正常模式</strong><small>50 題・不限時・答錯不會結束，安心閱讀詳解</small></span>
        </label>
        <label data-checked={mode === 'adventure' || undefined}>
          <input type="radio" name="daily-mode" checked={mode === 'adventure'} onChange={() => onModeChange('adventure')} />
          <span><strong>以闖關模式進行</strong><small>六層魔王・累積血量・答對 50 題才算全破</small></span>
        </label>
      </fieldset>
      <fieldset className={styles.subjectChoices}>
        <legend>選擇今日科目</legend>
        {subjects.map((subject) => {
          const checked = selectedSubjects.includes(subject.id);
          const result = completionResults[subject.id];
          return (
            <label
              key={subject.id}
              data-checked={checked || undefined}
              data-result={Boolean(result) || undefined}
            >
              <input
                type="radio"
                name="daily-subject"
                checked={checked}
                onChange={() => onToggleSubject(subject.id)}
              />
              <span>
                <strong>{subject.name}</strong>
                <small>
                  {result ? (
                    <>
                      <IconCalendarClock size={14} />
                      今日上次{result.status === 'failed' ? '挑戰結束' : '完成'}・答對 {result.correct} / {result.answered} 題，可再次挑戰
                    </>
                  ) : checked && !loading ? (
                    `題庫 ${subjectCounts[subject.id] ?? 0} 題，${mode === 'normal' ? '今日抽 50 題' : '闖關需答對 50 題'}`
                  ) : (
                    subject.description
                  )}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>

      {loadFailed ? (
        <div className={styles.notice} role="alert">
          <IconAlertTriangle size={20} aria-hidden="true" />
          <span>部分題庫載入失敗，已載入的科目仍可建立練習。</span>
          <Button onClick={onRetry}>重新載入</Button>
        </div>
      ) : null}

      <footer className={styles.setupFooter}>
        <span>
          {loading ? (
            <><IconLoader2 size={18} aria-hidden="true" /> 正在準備題庫…</>
          ) : selectedSubject ? (
            <>已選 {subjectShortName(selectedSubject)}・{mode === 'normal' ? '今日 50 題' : '目標答對 50 題'}{!readyToStart ? '・闖關需至少 74 題，請改用正常模式' : ''}</>
          ) : (
            <>請選擇今日要挑戰的科目。</>
          )}
        </span>
        <Button
          variant="primary"
          disabled={loading || !selectedSubjects.length || !readyToStart}
          onClick={onStart}
        >
          <IconFlag3 size={18} aria-hidden="true" />
          建立今日挑戰
        </Button>
      </footer>
    </section>
  );
}

function ProgressOverview({ session, questionById, subject, onReset }: {
  session: DailyPracticeSession; questionById: Map<string, Question>; subject: SubjectId; onReset: () => void;
}) {
  const answered = session.questionIds.filter(id => questionById.has(id) && session.answers[id]);
  const correct = answered.filter(id => session.answers[id].correct).length;
  const run = getDailyRunState(session);
  const normal = session.mode === 'normal';
  const inventory = getDailyRelicInventory(session.questionIds, session.answers, session.relicUses);
  return <section className={styles.progressOverview} aria-label="每日練習進度與關卡">
    {!normal ? <ol className={styles.levelMap} aria-label={`${subjectShortName(subject)}關卡進度`}>
      {DAILY_STAGES.map((stage, index) => {
        const complete = run.stages[index].correct >= stage.questions;
        const failed = session.status === 'failed' && index === run.stageIndex;
        return <li key={index} data-complete={complete || undefined}
          data-active={!complete && !failed && index === run.stageIndex || undefined}
          data-failed={failed || undefined} data-boss>
          <span>{failed ? <IconX size={17} /> : complete ? <IconCircleCheck size={17} /> : index === run.stageIndex ? index + 1 : <IconLock size={14} />}</span>
          <small>{getDailyStageTheme(subject, index).name}</small>
        </li>;
      })}
    </ol> : null}
    <div className={styles.scoreboard} aria-label="每日練習統計">
      <span><strong>{answered.length}</strong>{normal ? ` / ${session.questionIds.length}` : ''}<small>已作答</small></span>
      <span><strong>{correct}</strong>{normal ? '' : ' / 50'}<small>答對</small></span>
      <span><strong>{answered.length - correct}</strong><small>累積答錯</small></span>
      {!normal ? <span><strong><IconSparkles size={15} /> {Object.values(inventory).reduce((a,b) => a+b,0)}</strong>
        <small>寶具・連對 {run.streak} / 3</small></span> : null}
    </div>
    <button type="button" className={styles.reset} onClick={onReset}><IconRefresh size={16} /> 重新選科／模式</button>
  </section>;
}

function CompletionSummary({
  session,
  subject,
  questionById,
  failed,
  onSelectSubjects,
}: {
  session: DailyPracticeSession;
  subject: SubjectId;
  questionById: Map<string, Question>;
  failed: boolean;
  onSelectSubjects: () => void;
}) {
  const subjectQuestionIds = session.questionIds.filter(
    (id) => questionById.get(id)?.subject === subject,
  );
  const answeredIds = subjectQuestionIds.filter((id) => session.answers[id]);
  const wrongIds = answeredIds.filter((id) => !session.answers[id].correct);
  const correctCount = answeredIds.length - wrongIds.length;
  const accuracy = answeredIds.length
    ? Math.round((correctCount / answeredIds.length) * 100)
    : 0;

  return (
    <div className={styles.completionArea}>
      <section className={styles.completed}>
        {failed ? <IconShieldX size={49} stroke={1.7} aria-hidden="true" /> :
          <IconTrophy size={49} stroke={1.7} aria-hidden="true" />}
        <span className={styles.eyebrow}>{failed ? 'DAILY STOP' : 'DAILY CLEAR'}</span>
        <h3>{subjectShortName(subject)}今日挑戰{failed ? '結束' : '完成'}</h3>
        <p>完成 {answeredIds.length} 題，答對 {correctCount} 題、答錯 {wrongIds.length} 題。</p>
        <strong>{accuracy}% 正確率</strong>
        <div className={styles.completionActions}>
          <Button onClick={onSelectSubjects}>選擇其他科目</Button>
        </div>
      </section>

      <section className={styles.completionReview} aria-labelledby="daily-completion-review">
        <header>
          <div>
            <span>WRONG ANSWERS</span>
            <h3 id="daily-completion-review">本次錯題整理</h3>
          </div>
          <strong>{wrongIds.length} 題</strong>
        </header>
        {wrongIds.length ? (
          <div className={styles.completionWrongList}>
            {wrongIds.map((questionId) => {
              const question = questionById.get(questionId);
              const answer = session.answers[questionId];
              if (!question || !answer) return null;
              const displayedQuestion = applyDailyOptionOrder(
                question,
                session.optionOrders[questionId],
              );
              return (
                <article key={questionId}>
                  <div className={styles.questionMeta}>
                    <Tag>{question.year} 年</Tag>
                    <Tag tone="green">{question.primaryCategory}</Tag>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <DailyExplanation
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                  />
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor question={displayedQuestion} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.noWrong}>本次全數答對，沒有需要再次檢討的題目。</p>
        )}
      </section>
    </div>
  );
}

export function DailyPage() {
  const ready = useClientReady();
  const { state, dispatch, reportPersistence } = useAppState();
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectId[]>(['law']);
  const [selectedMode, setSelectedMode] = useState<DailyMode>('normal');
  const [completionRecord, setCompletionRecord] = useState<DailyCompletionRecord>({
    date: getTaipeiDateKey(),
    subjects: [],
    results: {},
  });
  const [session, setSession] = useState<DailyPracticeSession | null>(null);
  const [stageTransition, setStageTransition] = useState<DailyPracticeSession | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<{
    questionId: string;
    selected: number;
  }>();
  const [restored, setRestored] = useState(false);
  const [today, setToday] = useState(getTaipeiDateKey);
  const [nowMs, setNowMs] = useState(Date.now);
  const bank = useSubjectQuestions(session?.subjects ?? selectedSubjects);

  const finishTransition = useCallback(() => {
    if (!stageTransition) return;
    setNowMs(Date.now());
    setSession(stageTransition);
    setStageTransition(null);
    setDraftAnswer(undefined);
  }, [stageTransition]);

  useEffect(() => {
    if (!ready || restored) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const storedSession = parseDailyPracticeSession(
        readStoredValue(DAILY_PRACTICE_STORAGE_KEY),
        today,
      );
      const storedCompletions = parseDailyCompletionRecord(
        readStoredValue(DAILY_COMPLETION_STORAGE_KEY),
        today,
      );
      let normalizedCompletions = storedCompletions;
      const storedSubject = storedSession?.subjects[0];
      if (storedSession && storedSubject) {
        if (storedSession.status === 'completed' || storedSession.status === 'failed') {
          normalizedCompletions = {
            date: storedCompletions.date,
            subjects: [...new Set([...storedCompletions.subjects, storedSubject])],
            results: {
              ...storedCompletions.results,
              [storedSubject]: createDailyCompletionResult(
                storedSession.answers,
                storedSession.status,
              ),
            },
          };
        }
      }
      setCompletionRecord(normalizedCompletions);
      if (storedSession) {
        setSession(pauseDailyQuestion(storedSession));
        setSelectedMode(storedSession.mode ?? 'normal');
        setSelectedSubjects(storedSession.subjects);
      } else {
        setSelectedSubjects(['law']);
      }
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [ready, restored, today]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDate = getTaipeiDateKey();
      removeStoredSession();
      setSession(null);
      setStageTransition(null);
      setDraftAnswer(undefined);
      setCompletionRecord({ date: nextDate, subjects: [], results: {} });
      setSelectedSubjects(['law']);
      setToday(nextDate);
    }, getMillisecondsUntilTaipeiMidnight() + 250);
    return () => window.clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    if (!session) return;
    reportPersistence(
      'daily-practice',
      writeStoredValue(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session)),
    );
  }, [reportPersistence, session]);

  useEffect(() => {
    if (!restored) return;
    reportPersistence(
      'daily-completions',
      writeStoredValue(
        DAILY_COMPLETION_STORAGE_KEY,
        JSON.stringify(completionRecord),
      ),
    );
  }, [completionRecord, reportPersistence, restored]);

  const questionById = useMemo(
    () => new Map(bank.questions.map((question) => [question.id, question])),
    [bank.questions],
  );
  const currentQuestionId = session?.questionIds[session.currentIndex];
  const sourceCurrentQuestion = currentQuestionId
    ? questionById.get(currentQuestionId)
    : undefined;
  const currentOptionOrder = sourceCurrentQuestion ? session?.optionOrders[sourceCurrentQuestion.id] : undefined;
  const currentQuestion = useMemo(() => sourceCurrentQuestion
    ? applyDailyOptionOrder(sourceCurrentQuestion, currentOptionOrder)
    : undefined, [sourceCurrentQuestion, currentOptionOrder]);
  const currentAnswer = currentQuestionId
    ? session?.answers[currentQuestionId]
    : undefined;
  let selectedOption = currentAnswer && currentAnswer.selected >= 0
    ? currentAnswer.selected
    : undefined;
  if (
    selectedOption === undefined &&
    draftAnswer &&
    draftAnswer.questionId === currentQuestionId
  ) {
    selectedOption = draftAnswer.selected;
  }

  useEffect(() => {
    if (!session || session.mode === 'normal' || session.status !== 'practice' || currentAnswer ||
      !session.questionDeadlineMs || (currentQuestion && bank.status !== 'loading')) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setSession(current => current && current.questionIds[current.currentIndex] === currentQuestionId
        ? pauseDailyQuestion(current) : current);
    });
    return () => { active = false; };
  }, [bank.status, currentAnswer, currentQuestion, currentQuestionId, session]);

  useEffect(() => {
    if (
      !session ||
      session.status !== 'practice' ||
      !currentQuestionId ||
      !currentQuestion ||
      bank.status === 'loading' ||
      session.mode === 'normal' ||
      currentAnswer ||
      session.questionDeadlineMs
    ) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const startedAt = Date.now();
      setNowMs(startedAt);
      setSession((current) => current &&
        current.status === 'practice' &&
        current.questionIds[current.currentIndex] === currentQuestionId &&
        !current.answers[currentQuestionId] &&
        !current.questionDeadlineMs
          ? startDailyQuestion(current, startedAt)
        : current);
    });
    return () => {
      active = false;
    };
  }, [bank.status, currentAnswer, currentQuestionId, currentQuestion, session]);

  useEffect(() => {
    if (!session || session.mode === 'normal' || session.status !== 'practice' || currentAnswer || !currentQuestion || bank.status === 'loading') return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [bank.status, currentAnswer, currentQuestionId, currentQuestion, session]);

  useEffect(() => {
    if (
      !session ||
      session.status !== 'practice' ||
      !currentQuestionId ||
      currentAnswer ||
      !session.questionDeadlineMs
    ) {
      return;
    }
    const now = Date.now();
    const hpDelay = getDailyHealth(session, now) / DAILY_HP_DRAIN_PER_SECOND * 1000 +
      Math.max(0, Math.max(session.barrierUntilMs ?? 0, session.guardUntilMs ?? 0) - now);
    const delay = Math.max(0, Math.ceil(Math.min(session.questionDeadlineMs - now, hpDelay)));
    const timeout = window.setTimeout(() => {
      const at = Date.now();
      setNowMs(at);
      setSession(current => {
        if (!current || current.questionIds[current.currentIndex] !== currentQuestionId ||
          current.mode === 'normal' || current.answers[currentQuestionId] ||
          (getDailyRemainingTimeMs(current.questionDeadlineMs, at) > 0 && getDailyHealth(current, at) > 0)) return current;
        return answerDailyQuestion(current, -1, false, at);
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [currentAnswer, currentQuestionId, session]);

  useEffect(() => {
    if (!session || session.status !== 'failed') return;
    const subject = session.subjects[0];
    const result = createDailyCompletionResult(session.answers, 'failed');
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCompletionRecord((current) => {
        const existing = current.results[subject];
        if (
          current.subjects.includes(subject) &&
          existing?.answered === result.answered &&
          existing.correct === result.correct &&
          existing.status === result.status
        ) {
          return current;
        }
        return {
          date: current.date,
          subjects: [...new Set([...current.subjects, subject])],
          results: { ...current.results, [subject]: result },
        };
      });
    });
    return () => {
      active = false;
    };
  }, [session]);

  function toggleSubject(subject: SubjectId) {
    setSelectedSubjects([subject]);
  }

  function startPractice() {
    const next = createDailyPracticeSession(bank.questions, selectedSubjects, today, Math.random, selectedMode);
    if (next.questionIds.length) {
      const startedAt = Date.now();
      setNowMs(startedAt);
      setSession(startDailyQuestion(next, startedAt));
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function markSubjectCompleted(
    subject: SubjectId,
    answers: DailyPracticeSession['answers'],
    status: DailyCompletionResult['status'],
  ) {
    setCompletionRecord((current) => ({
      date: current.date,
      subjects: [...new Set([...current.subjects, subject])],
      results: {
        ...current.results,
        [subject]: createDailyCompletionResult(answers, status),
      },
    }));
  }

  function answerQuestion() {
    if (!session || !currentQuestion || selectedOption === undefined || currentAnswer) return;
    const at = Date.now();
    const correct = isQuestionCorrect(currentQuestion, selectedOption);
    const next = answerDailyQuestion(session, selectedOption, correct, at);
    if (next === session) return;
    const saved = next.answers[currentQuestion.id];
    if (!saved?.timedOut) dispatch({
      type: 'save-answer', questionId: currentQuestion.id,
      selected: session.optionOrders[currentQuestion.id]?.[selectedOption] ?? selectedOption,
      correct, answeredAt: new Date(at).toISOString(),
    });
    setNowMs(at);
    setSession(next);
  }

  function guardAttack() {
    const guardedAt = Date.now();
    setNowMs(guardedAt);
    setSession(current => current ? activateDailyGuard(current, guardedAt) : current);
  }

  function activateRelic(type: DailyRelicType) {
    if (
      !session ||
      !currentQuestion ||
      !currentQuestionId ||
      currentAnswer ||
      session.relicUses[currentQuestionId] ||
      currentRelicInventory[type] <= 0
    ) {
      return;
    }
    const now = Date.now();
    if (session.mode === 'normal' || getDailyRemainingTimeMs(session.questionDeadlineMs, now) <= 0 || getDailyHealth(session, now) <= 0) return;
    const nextRelicUses = { ...session.relicUses, [currentQuestionId]: type };
    const nextSession: DailyPracticeSession = {
      ...settleDailyHealth(session, now),
      relicUses: nextRelicUses,
    };

    if (type === 'eliminate') {
      const eliminated = session.eliminatedOptions[currentQuestionId] ?? [];
      const accepted = getAcceptedAnswerIndexes(currentQuestion);
      const target = currentQuestion.options.findIndex(
        (_, index) => !accepted.includes(index) && !eliminated.includes(index),
      );
      if (target < 0) return;
      nextSession.eliminatedOptions = {
        ...session.eliminatedOptions,
        [currentQuestionId]: [...eliminated, target],
      };
    } else if (type === 'barrier') {
      const deadline = Math.max(
        session.questionDeadlineMs ?? now + DAILY_QUESTION_SECONDS * 1000,
        now,
      );
      nextSession.questionDeadlineMs = deadline + DAILY_BARRIER_SECONDS * 1000;
      nextSession.barrierUntilMs = now + DAILY_BARRIER_SECONDS * 1000;
    }

    setNowMs(now);
    setSession(nextSession);
  }

  function toggleEliminatedOption(option: number) {
    if (!session || !currentQuestionId || currentAnswer) return;
    const current = session.eliminatedOptions[currentQuestionId] ?? [];
    setSession({
      ...session,
      eliminatedOptions: {
        ...session.eliminatedOptions,
        [currentQuestionId]: current.includes(option)
          ? current.filter((index) => index !== option)
          : [...current, option],
      },
    });
  }

  function continuePractice() {
    if (!session || !currentAnswer) return;
    const next = advanceDailyQuestion(session);
    if (next.status === 'completed') markSubjectCompleted(session.subjects[0], next.answers, 'completed');
    setSession(next);
    setDraftAnswer(undefined);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function markReviewed(questionId: string) {
    if (!session) return;
    setSession({
      ...session,
      reviewedWrongIds: [...new Set([...session.reviewedWrongIds, questionId])],
    });
  }

  function finishReview() {
    if (!session || stageTransition) return;
    const next = finishDailyStageReview(session);
    if (next === session) return;
    if (next.status === 'completed') markSubjectCompleted(session.subjects[0], next.answers, 'completed');
    // Keep the saved session in paused review until the cutscene ends. Reloading
    // midway returns to review, without consuming HP/time or skipping a stage.
    if (session.mode !== 'normal' && next.status === 'practice' &&
      getDailyRunState(next).stageIndex > getDailyRunState(session).stageIndex) {
      setStageTransition(next);
    } else {
      setSession(next);
    }
    setDraftAnswer(undefined);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function returnToSelection(confirmReset = false) {
    if (
      confirmReset &&
      !window.confirm('確定要清除目前尚未完成的闖關進度並重新選科嗎？')
    ) {
      return;
    }
    const previousSubject = session?.subjects[0] ?? selectedSubjects[0] ?? 'law';
    removeStoredSession();
    setSession(null);
    setStageTransition(null);
    setDraftAnswer(undefined);
    setSelectedSubjects([previousSubject]);
  }

  if (!ready || !restored) {
    return (
      <div className={styles.loading}>
        <IconLoader2 size={26} /><span>正在讀取今日進度…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <DailySetup
        mode={selectedMode}
        onModeChange={setSelectedMode}
        selectedSubjects={selectedSubjects}
        completionResults={completionRecord.results}
        onToggleSubject={toggleSubject}
        onStart={startPractice}
        questions={bank.questions}
        loading={bank.status === 'loading'}
        loadFailed={bank.status === 'error'}
        onRetry={bank.retry}
      />
    );
  }

  const completedSubject = session.subjects[0];
  const focusSubject = session.subjects[0];
  const reviewReady = session.unreviewedWrongIds.every((id) =>
    session.reviewedWrongIds.includes(id),
  );
  const missingReviewQuestion = session.status === 'review' &&
    session.unreviewedWrongIds.some((id) => !questionById.has(id));
  const requiredQuestionMissing =
    (session.status === 'practice' && Boolean(currentQuestionId) && !currentQuestion) ||
    missingReviewQuestion;
  const currentSubjectQuestionIndex = currentQuestion
    ? session.questionIds
        .slice(0, session.currentIndex)
        .filter((id) => questionById.get(id)?.subject === currentQuestion.subject)
        .length
    : 0;
  const normal = session.mode === 'normal';
  const currentRun = getDailyRunState(session);
  const currentStageIndex = currentRun.stageIndex;
  const currentStage = getDailyStageTheme(session.subjects[0], currentStageIndex);
  const displayQuestionIndex = session.status === 'failed' ? Math.max(0, session.currentIndex - 1) : session.currentIndex;
  const previousProgress = getDailyRunState({ ...session, answers: Object.fromEntries(
    Object.entries(session.answers).filter(([id]) => id !== currentQuestionId),
  ) });
  const relicRewardCount = Math.max(0, currentRun.relicsEarned - previousProgress.relicsEarned);
  const currentRelicInventory = getDailyRelicInventory(
    session.questionIds,
    session.answers,
    session.relicUses,
    session.protectedWrongIds,
  );
  const remainingTimeMs = getDailyRemainingTimeMs(
    session.questionDeadlineMs,
    nowMs,
  );
  const barrierActive = Boolean(
    session.barrierUntilMs && session.barrierUntilMs > nowMs,
  );
  const reviewLevel = currentStageIndex + 1;
  const reviewWrongCount = session.unreviewedWrongIds.length;
  const reviewRank = reviewWrongCount === 0 ? 'S' : reviewWrongCount === 1 ? 'A' : 'B';
  return (
    <section className={styles.daily} data-mode={session.mode} data-playing={session.status === 'practice' || undefined}>
      {session.migrated ? <p className={styles.migrationNotice}>舊版進度已保留於正常模式；新的闖關規則請重新選科／模式開始。</p> : null}
      <div className={styles.battleColumn}>
        {!normal ? stageTransition ? (
          <DailyStageTransition nextSession={stageTransition} onComplete={finishTransition} />
        ) : <DailyBattleScene
          key={currentStageIndex}
          session={session}
          stageIndex={currentStageIndex}
          remainingTimeMs={remainingTimeMs}
          barrierActive={barrierActive}
          answer={session.status === 'failed'
            ? session.answers[session.questionIds[displayQuestionIndex]]
            : currentAnswer}
          nowMs={nowMs}
          onGuard={guardAttack}
        /> : null}
        {!normal && session.status === 'practice' ? (
          <DailyRelicDock session={session} inventory={currentRelicInventory}
            disabled={Boolean(currentAnswer)} onActivate={activateRelic} />
        ) : null}
        {focusSubject ? (
          <aside className={styles.sidebar} aria-label="挑戰資訊">
            <ProgressOverview
              session={session}
              questionById={questionById}
              subject={focusSubject}
              onReset={() => returnToSelection(true)}
            />
          </aside>
        ) : null}
      </div>
      <div className={styles.questionArea}>
        {bank.status === 'loading' || (requiredQuestionMissing && bank.status !== 'error') ? (
          <div className={styles.loading}><IconLoader2 size={26} /><span>正在載入今日題目…</span></div>
        ) : bank.status === 'error' && requiredQuestionMissing ? (
          <div className={styles.loading} role="alert">
            <IconAlertTriangle size={26} />
            <span>目前題目載入失敗，進度已保存。</span>
            <Button onClick={bank.retry}>重新載入</Button>
          </div>
        ) : session.status === 'review' ? (
          <section className={styles.review} aria-labelledby="daily-review-title">
            <header>
              <IconShieldX size={30} aria-hidden="true" />
              <div>
                <span>{normal ? '錯題檢討' : `STAGE ${reviewLevel} CLEAR・${currentStage.boss}`}</span>
                <h3 id="daily-review-title">
                  {reviewWrongCount ? '完成錯題檢討再前進' : '無傷通關！'}
                </h3>
                <p>{normal ? '確認每題錯誤原因後，繼續正常練習。' : reviewWrongCount
                  ? '魔王已由正確作答擊破；檢討只幫助理解，不會造成傷害。'
                  : '本層全數答對，獲得額外寶具獎勵。'}</p>
              </div>
              <strong className={styles.stageRank} aria-label={`本層評級 ${reviewRank}`}>
                {reviewRank}
              </strong>
            </header>
            {!normal && !reviewWrongCount ? (
              <div className={styles.flawlessReward} role="status">
                <IconSparkles size={28} />
                <div>
                  <strong>PERFECT CLEAR・寶具 +1</strong>
                  <span>無傷突破第 {reviewLevel} 層，獎勵已放入寶具列。</span>
                </div>
              </div>
            ) : null}
            <div className={styles.reviewList}>
              {session.unreviewedWrongIds.map((questionId) => {
                const question = questionById.get(questionId);
                const answer = session.answers[questionId];
                if (!question || !answer) return null;
                const displayedQuestion = applyDailyOptionOrder(
                  question,
                  session.optionOrders[questionId],
                );
                const reviewed = session.reviewedWrongIds.includes(questionId);
                return (
                  <article key={questionId} data-reviewed={reviewed || undefined}>
                    <div className={styles.questionMeta}>
                      <Tag>{question.year} 年</Tag>
                      <Tag tone="green">{subjectShortName(question.subject)}</Tag>
                      <Tag>{question.primaryCategory}</Tag>
                      <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                    </div>
                    <QuestionPrompt question={question} compact />
                    <QuestionAnswerPanel
                      question={displayedQuestion}
                      selectedIndex={answer.selected}
                      showStatusLabels
                    />
                    <DailyExplanation
                      question={displayedQuestion}
                      selectedIndex={answer.selected}
                    />
                    <div className={styles.noteEditor}>
                      <ReviewNoteEditor question={displayedQuestion} />
                    </div>
                    <Button
                      variant={reviewed ? 'secondary' : 'primary'}
                      disabled={reviewed}
                      onClick={() => markReviewed(questionId)}
                    >
                      <IconCircleCheck size={17} />
                      {reviewed ? '已完成檢討' : '我已理解錯誤原因'}
                    </Button>
                  </article>
                );
              })}
            </div>
            <footer>
              <span>{session.reviewedWrongIds.length} / {session.unreviewedWrongIds.length} 題已檢討</span>
              <Button variant="primary" disabled={!reviewReady || Boolean(stageTransition)} onClick={finishReview}>
                {stageTransition ? '正在前往下一層…' : '繼續闖關'}
              </Button>
            </footer>
          </section>
        ) : (session.status === 'completed' || session.status === 'failed') && completedSubject ? (
          <CompletionSummary
            session={session}
            subject={completedSubject}
            questionById={questionById}
            failed={session.status === 'failed'}
            onSelectSubjects={() => returnToSelection(false)}
          />
        ) : currentQuestion ? (
          <article
            className={styles.challenge}
            data-result={currentAnswer ? (currentAnswer.correct ? 'correct' : 'wrong') : undefined}
          >
            <header>
              <div className={styles.questionMeta}>
                <Tag>{normal ? '正常練習' : `本科第 ${currentStageIndex + 1} 層・${currentStage.name}`}</Tag>
                <Tag tone="green">{normal ? `${currentQuestion.year} 年・第 ${currentQuestion.questionNumber} 題` : `本層答對 ${currentRun.stages[currentStageIndex].correct}/${currentStage.questions} 題`}</Tag>
                <Tag>{subjectShortName(currentQuestion.subject)}</Tag>
                <Tag tone="purple">{currentQuestion.primaryCategory}</Tag>
              </div>
              <div className={styles.challengeActions}>
                <DifficultButton
                  active={state.difficultQuestionIds.includes(currentQuestion.id)}
                  onClick={() => dispatch({
                    type: 'toggle-difficult',
                    questionId: currentQuestion.id,
                  })}
                />
                <strong>{normal ? `${currentSubjectQuestionIndex + 1} / ${session.questionIds.length}` : `答對 ${currentRun.totalCorrect} / 50`}</strong>
              </div>
            </header>
            <div className={styles.answerBody} role="region" aria-label="題目與選項">
              <QuestionPrompt question={currentQuestion} />
              <OptionGroup
                label={`每日練習第 ${currentSubjectQuestionIndex + 1} 題請選擇答案`}
                options={currentQuestion.options}
                value={selectedOption}
                disabled={Boolean(currentAnswer)}
                eliminatedValues={session.eliminatedOptions[currentQuestion.id] ?? []}
                onValueChange={(selected) =>
                  setDraftAnswer({ questionId: currentQuestion.id, selected })
                }
                onToggleEliminated={toggleEliminatedOption}
              />
              {!normal && currentAnswer?.correct ? (
                <div className={styles.rewardBurst} aria-hidden="true">
                  <IconSparkles size={22} /><strong>血量 +{DAILY_CORRECT_HEAL}{relicRewardCount ? `・寶具 +${relicRewardCount}` : ''}</strong>
                  <span>目前 HP {Math.ceil(session.hp ?? 100)} / 100・答對不會抵銷錯題次數</span>
                </div>
              ) : null}
              {currentAnswer && !currentAnswer.correct ? (
                <div className={styles.answerResult} data-correct={currentAnswer.correct || undefined} role="status">
                  <IconX size={22} />
                  <div>
                    <strong>{currentAnswer.timedOut
                      ? '時間到，已加入本輪檢討'
                      : normal ? '已加入本次錯題整理' : session.protectedWrongIds.includes(currentQuestion.id)
                        ? session.guardUses?.[currentQuestion.id] === 'perfect'
                          ? '完美格擋擋下反擊，錯題次數仍 +1'
                          : '結界擋下反擊，錯題次數仍 +1'
                        : '答錯了，魔王反擊 −10 HP・錯題次數 +1'}</strong>
                    <span>正確答案：{formatCorrectAnswer(currentQuestion)}</span>
                  </div>
                </div>
              ) : null}
              {currentAnswer ? (
                <div className={styles.instantExplanation}>
                  <DailyExplanation
                    question={currentQuestion}
                    selectedIndex={currentAnswer.selected}
                  />
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor key={currentQuestion.id} question={currentQuestion} />
                  </div>
                </div>
              ) : null}
            </div>
            <footer>
              <span>
                {normal ? '不限時・安心作答' : <><IconHeart size={15} /> HP {Math.ceil(getDailyHealth(session, nowMs))}/100
                  ・本層錯 {currentRun.stages[currentStageIndex].wrong}/{currentStage.wrongLimit}</>}
              </span>
              {currentAnswer ? (
                <Button variant="primary" onClick={continuePractice}>下一題</Button>
              ) : (
                <Button variant="primary" aria-label="確認答案" disabled={selectedOption === undefined} onClick={answerQuestion}>
                  {!normal ? <IconSwords size={18} /> : null} 確認答案{!normal ? '・出招' : ''}
                </Button>
              )}
            </footer>
          </article>
        ) : null}
      </div>
    </section>
  );
}
