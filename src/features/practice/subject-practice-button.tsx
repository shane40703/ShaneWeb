import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconListCheck } from '@tabler/icons-react';
import { Button, useToast } from '@/components/ui/ui';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import type { Question, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import {
  createPracticeSessionFromQuestions,
  DEFAULT_PRACTICE_SETTINGS,
  hasPracticeProgress,
  parsePracticeSession,
  PRACTICE_SESSION_STORAGE_KEY,
  practiceQuestionHref,
  subjectReviewQuestions,
} from './practice-session';
import styles from './subject-practice-button.module.css';

/** Start a complete, fixed subject set using the regular practice quiz and persistence. */
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
  const [starting, setStarting] = useState(false);
  const candidates = subjectReviewQuestions(questions, subject);
  const label = source === 'difficult' ? '難題標記' : '常錯題目';

  async function start() {
    if (starting || loading || !candidates.length) return;
    const current = parsePracticeSession(readStoredValue(PRACTICE_SESSION_STORAGE_KEY));
    if (current && hasPracticeProgress(current) && !window.confirm(
      '目前的每日抽題練習還沒完成，要放棄並改練本科目這組題目嗎？作答進度會清除。',
    )) return;
    const session = {
      ...createPracticeSessionFromQuestions(candidates, subject, DEFAULT_PRACTICE_SETTINGS.shuffleOptions),
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
    <Button variant="primary" disabled={loading || starting || !candidates.length} onClick={() => void start()}>
      <IconListCheck size={18} aria-hidden="true" />作答本科目所有{label}
    </Button>
    <span>{loading ? '正在載入本科目題目，完成後即可整組練習' : `跨所有年度・共 ${candidates.length} 題選擇題`}</span>
  </div>;
}
