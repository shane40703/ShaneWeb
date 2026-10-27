import { useRouter } from 'next/router';
import { useId, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { IconListCheck } from '@tabler/icons-react';
import { Button, useToast } from '@/components/ui/ui';
import uiStyles from '@/components/ui/ui.module.css';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  createPracticeSessionFromQuestions,
  DEFAULT_PRACTICE_SETTINGS,
  hasPracticeProgress,
  parsePracticeSession,
  PRACTICE_COUNT_OPTIONS,
  PRACTICE_SESSION_STORAGE_KEY,
  practiceQuestionHref,
  subjectReviewQuestions,
} from './practice-session';
import styles from './subject-practice-button.module.css';

/** Configure a subject's marked/mistaken questions before replacing any saved progress. */
export function SubjectPracticeButton({
  questions, subject, source, loading = false,
}: {
  questions: readonly Question[];
  subject: SubjectId;
  source: 'difficult' | 'wrong';
  loading?: boolean;
}) {
  const router = useRouter();
  const { reportPersistence } = useAppState();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [countInput, setCountInput] = useState('50');
  const [shuffleOptions, setShuffleOptions] = useState(DEFAULT_PRACTICE_SETTINGS.shuffleOptions);
  const [starting, setStarting] = useState(false);
  const hintId = useId();
  const candidates = subjectReviewQuestions(questions, subject);
  const label = source === 'difficult' ? '難題標記' : '常錯題目';
  const count = Number(countInput);
  const validCount = countInput.trim() !== '' && Number.isInteger(count) && count >= 1 && count <= candidates.length;
  const unavailable = loading || starting || !candidates.length;

  async function start() {
    if (unavailable || !validCount) return;
    const current = parsePracticeSession(readStoredValue(PRACTICE_SESSION_STORAGE_KEY));
    if (current && hasPracticeProgress(current) && !window.confirm(
      '目前的每日抽題練習還沒完成，要放棄並改練本科目這組題目嗎？作答進度會清除。',
    )) return;
    const selected = count === candidates.length ? candidates : pickRandomItems(candidates, count);
    const session = {
      ...createPracticeSessionFromQuestions(selected, subject, shuffleOptions),
      reviewSource: source,
    };
    const saved = writeStoredValue(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(session));
    reportPersistence('practice-session', saved);
    if (saved !== 'saved') {
      notify('瀏覽器無法儲存練習進度，暫時無法開始這組題目。', undefined, 'error');
      return;
    }
    setStarting(true);
    try {
      if (!await router.push(practiceQuestionHref(0))) {
        notify('無法開啟練習頁，請再試一次。', undefined, 'error');
      }
    } catch {
      notify('無法開啟練習頁，請再試一次。', undefined, 'error');
    } finally {
      setStarting(false);
    }
  }

  return <div className={styles.actions}>
    <Dialog.Root open={open} onOpenChange={next => {
      if (starting) return;
      if (next) {
        setCountInput(String(Math.min(DEFAULT_PRACTICE_SETTINGS.count, candidates.length)));
        setShuffleOptions(DEFAULT_PRACTICE_SETTINGS.shuffleOptions);
      }
      setOpen(next);
    }}>
      <Dialog.Trigger render={<Button variant="primary" disabled={unavailable} />}>
        <IconListCheck size={18} aria-hidden="true" />作答本科目所有{label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={uiStyles.backdrop} />
        <Dialog.Viewport className={uiStyles.dialogViewport}>
          <Dialog.Popup className={`${uiStyles.dialogPopup} ${styles.dialog}`}>
            <Dialog.Title className={uiStyles.dialogTitle}>{label}重練設定</Dialog.Title>
            <Dialog.Description className={uiStyles.dialogDescription}>
              {getSubject(subject)?.name}・跨所有年度共 {candidates.length} 題選擇題。選好本次題數後才會開始，不受目前檢視的年度限制。
            </Dialog.Description>
            <form onSubmit={event => { event.preventDefault(); void start(); }}>
              <fieldset className={styles.settings} disabled={loading || starting}>
                <legend>進階選項</legend>
                <label className={styles.countField}>
                  本次題數
                  <input type="number" min={1} max={candidates.length} step={1} inputMode="numeric"
                    value={countInput} onChange={event => setCountInput(event.target.value)}
                    aria-invalid={!validCount} aria-describedby={hintId} required />
                </label>
                <div className={styles.presets} role="group" aria-label="快速選擇題數">
                  {PRACTICE_COUNT_OPTIONS.filter(value => value < candidates.length).map(value =>
                    <Button key={value} type="button" aria-pressed={count === value}
                      onClick={() => setCountInput(String(value))}>{value} 題</Button>,
                  )}
                  <Button type="button" aria-pressed={count === candidates.length}
                    onClick={() => setCountInput(String(candidates.length))}>全部（{candidates.length} 題）</Button>
                </div>
                <p id={hintId} className={styles.hint} role={!validCount ? 'alert' : undefined}>
                  {validCount ? '可自訂題數；未選全部時隨機抽取、不重複。其餘難題標記與錯題紀錄都會保留。'
                    : `請輸入 1～${candidates.length} 的整數題數。`}
                </p>
                <label className={styles.shuffle}>
                  <input type="checkbox" checked={shuffleOptions} onChange={event => setShuffleOptions(event.target.checked)} />
                  打亂選項順序
                </label>
              </fieldset>
              <div className={styles.dialogActions}>
                <Dialog.Close render={<Button disabled={starting} />}>取消</Dialog.Close>
                <Button type="submit" variant="primary" disabled={unavailable || !validCount}>
                  {starting ? '正在開啟…' : `開始練習（${validCount ? count : 0} 題）`}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
    <span>{loading ? '正在載入本科目題目，完成後即可整組練習' : `跨所有年度・共 ${candidates.length} 題選擇題`}</span>
  </div>;
}
