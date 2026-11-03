import { useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconChevronDown,
  IconFileTypePdf,
  IconLoader2,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import type { DailyPaper } from '@/features/daily/daily-paper';
import { useDailyPaperDownload } from '@/features/daily/daily-paper-download';
import { trackPractice } from '@/lib/analytics';
import type { SubjectId } from '@/lib/types';
import { getSubject, subjects } from '@/question-bank/catalog';
import {
  DEFAULT_PRACTICE_SETTINGS,
  isDefaultPracticeSettings,
  PRACTICE_COUNT_OPTIONS,
  type PracticePool,
  type PracticeSettings,
} from './practice-session';
import { TitledFieldset } from './titled-fieldset';
import styles from './practice-page.module.css';

const ADVANCED_ID = 'practice-advanced-options';

function estimatedMinutes(count: number) {
  return Math.max(1, Math.round(count * 1.4));
}

/** The extra option a small pool offers, so 50 can still mean "up to 50". */
function isAllOption(count: number, pool: PracticePool) {
  return (
    count === pool.candidates.length &&
    !(PRACTICE_COUNT_OPTIONS as readonly number[]).includes(count)
  );
}

export function PracticeSetup({
  subject,
  settings,
  pool,
  loading,
  loadFailed,
  onRetry,
  onSubjectChange,
  onSettingsChange,
  onStart,
  onMakePaper,
  resume,
}: {
  subject: SubjectId | null;
  settings: PracticeSettings;
  pool: PracticePool;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onSubjectChange: (subject: SubjectId) => void;
  onSettingsChange: (settings: PracticeSettings) => void;
  onStart: () => void;
  onMakePaper: () => DailyPaper | Promise<DailyPaper>;
  resume?: { subject: SubjectId; index: number; total: number; onResume: () => void };
}) {
  const paperDownload = useDailyPaperDownload();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const busy = !subject || loading || paperDownload.downloading;
  const canDraw = !busy && pool.count > 0;
  const customized = !isDefaultPracticeSettings(settings);
  const categoryLabel = pool.category === 'all' ? '全部類別' : pool.category;
  const summary = [
    `${loading ? settings.count : pool.count} 題`,
    `${pool.rangeStart}–${pool.rangeEnd} 年`,
    categoryLabel,
    settings.shuffleOptions ? '打亂選項' : '原始選項順序',
    settings.includeAllCredit ? '含一律給分' : '不含一律給分',
  ].join('・');

  function update(patch: Partial<PracticeSettings>) {
    onSettingsChange({ ...settings, ...patch });
  }

  // Nothing is awaited before download(): its font request needs the click gesture.
  async function downloadPaper() {
    const downloaded = await paperDownload.download(onMakePaper);
    if (downloaded && subject) trackPractice('paper_download', 'paper', subject);
  }

  return (
    <section className={styles.setup} aria-label="每日抽題練習設定">
      {resume ? <div className={styles.resume}>
        <span>未完成題組：{getSubject(resume.subject)?.shortName}・第 {resume.index}／{resume.total} 題</span>
        <Button onClick={resume.onResume}>繼續未完成練習</Button>
      </div> : null}
      <TitledFieldset
        title="選擇科目"
        className={styles.subjectChoices}
        data-compact
        disabled={paperDownload.downloading}
      >
        {subjects.map((item) => {
          const checked = item.id === subject;
          return (
            <label key={item.id} data-checked={checked || undefined}>
              <input
                type="radio"
                name="practice-subject"
                checked={checked}
                onChange={() => onSubjectChange(item.id)}
              />
              <span>
                <strong>{item.name}</strong>
              </span>
            </label>
          );
        })}
      </TitledFieldset>

      {loadFailed ? (
        <div className={styles.notice} role="alert">
          <IconAlertTriangle size={20} aria-hidden="true" />
          <span>部分題庫載入失敗，已載入的題目仍可建立練習。</span>
          <Button onClick={onRetry}>重新載入</Button>
        </div>
      ) : null}

      <section className={styles.advanced} data-open={advancedOpen || undefined}>
        <button
          type="button"
          className={styles.advancedToggle}
          aria-expanded={advancedOpen}
          aria-controls={ADVANCED_ID}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <IconAdjustmentsHorizontal size={20} aria-hidden="true" />
          <span>
            <strong>
              進階選項
              {customized ? <em>已調整</em> : null}
            </strong>
            <small>{subject ? summary : '請先選擇科目，再設定抽題條件'}</small>
          </span>
          <IconChevronDown
            className={styles.advancedChevron}
            size={18}
            aria-hidden="true"
          />
        </button>
        <div id={ADVANCED_ID} className={styles.advancedBody} hidden={!advancedOpen}>
          <TitledFieldset title="年度範圍" className={styles.advancedGroup} disabled={busy}>
            <p>起訖年度都包含在抽題範圍內。</p>
            <div className={styles.yearRange}>
              <label>
                從
                <select
                  aria-label="起始年度"
                  value={pool.fromYear}
                  onChange={(event) =>
                    update({ fromYear: Number(event.target.value), category: 'all' })
                  }
                >
                  {[...pool.availableYears].reverse().map((year) => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true">至</span>
              <label>
                到
                <select
                  aria-label="結束年度"
                  value={pool.toYear}
                  onChange={(event) =>
                    update({ toYear: Number(event.target.value), category: 'all' })
                  }
                >
                  {pool.availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
                </select>
              </label>
              <strong>
                <b>{pool.rangeCandidates.length}</b> 題符合年度
              </strong>
            </div>
          </TitledFieldset>

          <TitledFieldset title="題目類別" className={styles.advancedGroup} disabled={busy}>
            <p>可從跨年度的相同類別集中抽題。</p>
            <label className={styles.categorySelect}>
              <span>題目類別</span>
              <select
                value={pool.category}
                onChange={(event) => update({ category: event.target.value })}
              >
                <option value="all">全部類別（{pool.rangeCandidates.length} 題）</option>
                {pool.categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}（{category.count} 題）
                  </option>
                ))}
              </select>
            </label>
            <small className={styles.groupNote}>
              目前選擇 <strong>{categoryLabel}</strong>，共 {pool.candidates.length} 題
            </small>
          </TitledFieldset>

          <TitledFieldset title="題數" className={styles.advancedGroup} disabled={busy}>
            <p>從符合年度與類別的題目中隨機抽取，每次抽題都重新抽。</p>
            {pool.countOptions.length ? (
              <div className={styles.countChoices}>
                {pool.countOptions.map((count) => (
                  <button
                    type="button"
                    key={count}
                    aria-pressed={count === pool.count}
                    onClick={() => update({ count })}
                  >
                    <strong>{count}</strong> 題
                    <small>
                      {isAllOption(count, pool) ? '全部・' : ''}約{' '}
                      {estimatedMinutes(count)} 分鐘
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <small className={styles.groupNote}>
                {loading ? '正在準備題庫…' : '目前條件沒有可抽的題目。'}
              </small>
            )}
          </TitledFieldset>

          <TitledFieldset title="選項與題目" className={styles.advancedGroup} disabled={busy}>
            <label className={styles.checkChoice}>
              <input
                type="checkbox"
                checked={settings.shuffleOptions}
                onChange={(event) => update({ shuffleOptions: event.target.checked })}
              />
              <span>
                <strong>打亂選項順序</strong>
                <small>每題選項順序隨機排列，同一題組內保持不變。</small>
              </span>
            </label>
            <label className={styles.checkChoice}>
              <input
                type="checkbox"
                checked={settings.includeAllCredit}
                onChange={(event) =>
                  update({ includeAllCredit: event.target.checked, category: 'all' })
                }
              />
              <span>
                <strong>包含一律給分題目</strong>
                <small>
                  這個年度範圍有 {pool.allCreditInRange} 題一律給分，選任何選項都算答對。
                </small>
              </span>
            </label>
          </TitledFieldset>

          <div className={styles.advancedFooter}>
            <small>預設：50 題、全部年度與類別、打亂選項、不含一律給分。</small>
            <Button
              disabled={!customized || busy}
              onClick={() => onSettingsChange(DEFAULT_PRACTICE_SETTINGS)}
            >
              恢復預設
            </Button>
          </div>
        </div>
      </section>

      {paperDownload.error ? (
        <p className={styles.paperNotice} role="alert">
          {paperDownload.error} 可以重新點選製作。
        </p>
      ) : null}
      {paperDownload.fontNotice && !paperDownload.fontNotice.includes('：本次使用 ') ? (
        <p className={styles.paperNotice} role="status">
          {paperDownload.fontNotice}
        </p>
      ) : null}

      <footer className={styles.setupFooter}>
        <span>
          {!subject ? '請先選擇科目，再開始練習。' : loading ? (
            <>
              <IconLoader2 size={18} aria-hidden="true" /> 正在準備題庫…
            </>
          ) : pool.count ? (
            <>
              已選 {getSubject(subject)?.shortName}・從 {pool.candidates.length} 題中抽{' '}
              {pool.count} 題
            </>
          ) : (
            <>目前條件沒有可抽的題目，請調整進階選項。</>
          )}
        </span>
        <div className={styles.setupActions}>
          <Button disabled={!canDraw} onClick={() => void downloadPaper()}>
            <IconFileTypePdf size={17} aria-hidden="true" />
            {paperDownload.downloading ? '正在製作 PDF…' : '製作紙本檔案'}
          </Button>
          <Button variant="primary" disabled={!canDraw} onClick={onStart}>
            線上作答
          </Button>
        </div>
      </footer>
    </section>
  );
}
