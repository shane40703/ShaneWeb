import Head from 'next/head';
import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IconAlertTriangle,
  IconCheck,
  IconMoonStars,
  IconPalette,
  IconSparkles,
  IconSun,
} from '@tabler/icons-react';
import { useTheme } from '@/components/theme-provider';
import { Button, useToast } from '@/components/ui/ui';
import {
  DEFAULT_THEME_PALETTES,
  deriveThemeTokens,
  isHexColor,
  type ThemeMode,
  type ThemePalette,
  type ThemeContrastIssue,
  validateThemePalette,
} from '@/lib/theme';
import {
  findOfficialThemePreset,
  OFFICIAL_THEME_PRESETS,
  themePalettesMatch,
  type OfficialThemePreset,
} from '@/lib/theme-presets';
import styles from '@/features/appearance/appearance-page.module.css';

type PaletteKey = keyof ThemePalette;

const modes: Array<{
  mode: ThemeMode;
  label: string;
  description: string;
}> = [
  { mode: 'light', label: '淺色模式', description: '適合明亮環境' },
  { mode: 'dark', label: '深色模式', description: '適合低光環境' },
];

const colorFields: Array<{
  key: PaletteKey;
  label: string;
  description: string;
}> = [
  { key: 'background', label: '頁面背景', description: '網站最底層的背景色' },
  { key: 'surface', label: '卡片背景', description: '卡片與主要內容區塊' },
  { key: 'text', label: '主要文字', description: '標題與正文內容' },
  { key: 'muted', label: '次要文字', description: '說明與輔助資訊' },
  { key: 'accent', label: '重點色', description: '連結、焦點與主要操作' },
  { key: 'border', label: '邊框色', description: '卡片與控制項邊界' },
];

const modeLabels: Record<ThemeMode, string> = {
  light: '淺色模式',
  dark: '深色模式',
};

const foregroundLabels: Record<string, string> = {
  text: '主要文字',
  muted: '次要文字',
  accent: '重點色',
  onPrimary: '按鈕文字',
};

const backgroundLabels: Record<string, string> = {
  background: '頁面背景',
  surface: '卡片背景',
  surface2: '次層卡片背景',
  primarySolid: '主要按鈕',
  primaryGradient: '按鈕漸層',
  primaryHover: '按鈕懸停',
};

function contrastPairLabel(issue: ThemeContrastIssue) {
  const foreground = foregroundLabels[issue.foreground] ?? '前景色';
  const background = backgroundLabels[issue.background] ?? '背景色';
  return `${foreground}與${background}`;
}

function copyPalette(palette: ThemePalette): ThemePalette {
  return { ...palette };
}

function paletteIsSyntacticallyValid(palette: ThemePalette) {
  return colorFields.every(({ key }) => isHexColor(palette[key]));
}

function storageFailureDescription(result: 'quota-exceeded' | 'unavailable') {
  return result === 'quota-exceeded'
    ? '瀏覽器儲存空間已滿；本次瀏覽仍可使用，重新整理後會還原。'
    : '瀏覽器目前不允許保存；本次瀏覽仍可使用，重新整理後會還原。';
}

export default function AppearancePage() {
  const {
    mode,
    palettes,
    customPalettes,
    savePalette,
    resetPalette,
    hydrated,
  } = useTheme();
  const { notify } = useToast();
  const syncedStoredPalettes = useRef(false);
  const [editingMode, setEditingMode] = useState<ThemeMode>(mode);
  const [drafts, setDrafts] = useState<Record<ThemeMode, ThemePalette>>(() => ({
    light: copyPalette(palettes.light),
    dark: copyPalette(palettes.dark),
  }));
  const [previewPalettes, setPreviewPalettes] = useState<
    Record<ThemeMode, ThemePalette>
  >(() => ({
    light: copyPalette(palettes.light),
    dark: copyPalette(palettes.dark),
  }));
  const [defaultDrafts, setDefaultDrafts] = useState<
    Record<ThemeMode, boolean>
  >({ light: false, dark: false });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!hydrated || syncedStoredPalettes.current) return;
    syncedStoredPalettes.current = true;
    setEditingMode(mode);
    setDrafts({
      light: copyPalette(palettes.light),
      dark: copyPalette(palettes.dark),
    });
    setPreviewPalettes({
      light: copyPalette(palettes.light),
      dark: copyPalette(palettes.dark),
    });
  }, [hydrated, mode, palettes]);

  const draft = drafts[editingMode];
  const syntaxValid = paletteIsSyntacticallyValid(draft);
  const validation = useMemo(
    () =>
      syntaxValid
        ? validateThemePalette(editingMode, draft)
        : { valid: false, issues: [] },
    [draft, editingMode, syntaxValid],
  );
  const previewStyle = useMemo(
    () =>
      ({
        ...deriveThemeTokens(editingMode, previewPalettes[editingMode]),
        colorScheme: editingMode,
      }) as CSSProperties,
    [editingMode, previewPalettes],
  );
  const invalidKeys = colorFields
    .filter(({ key }) => !isHexColor(draft[key]))
    .map(({ key }) => key);
  const canApply = hydrated && syntaxValid && validation.valid && !saving;
  const currentModeLabel = modeLabels[editingMode];
  const selectedOfficialPreset = useMemo(
    () => findOfficialThemePreset(editingMode, draft),
    [draft, editingMode],
  );
  const appliedOfficialPreset = useMemo(
    () => findOfficialThemePreset(editingMode, palettes[editingMode]),
    [editingMode, palettes],
  );

  function selectMode(nextMode: ThemeMode) {
    setEditingMode(nextMode);
    setStatusMessage('');
  }

  function updateColor(key: PaletteKey, value: string) {
    const normalized = value.toUpperCase();
    const nextDraft = { ...drafts[editingMode], [key]: normalized };

    setDrafts((current) => ({ ...current, [editingMode]: nextDraft }));
    setDefaultDrafts((current) => ({ ...current, [editingMode]: false }));
    setStatusMessage('');

    if (paletteIsSyntacticallyValid(nextDraft)) {
      setPreviewPalettes((current) => ({
        ...current,
        [editingMode]: copyPalette(nextDraft),
      }));
    }
  }

  function loadOfficialPreset(preset: OfficialThemePreset) {
    const presetPalette = copyPalette(preset.palette);
    setDrafts((current) => ({
      ...current,
      [editingMode]: presetPalette,
    }));
    setPreviewPalettes((current) => ({
      ...current,
      [editingMode]: copyPalette(preset.palette),
    }));
    setDefaultDrafts((current) => ({
      ...current,
      [editingMode]: themePalettesMatch(
        preset.palette,
        DEFAULT_THEME_PALETTES[editingMode],
      ),
    }));
    setStatusMessage(
      `已選擇「${preset.name}」，可先查看預覽；按「套用此模式」後才會保存。`,
    );
  }

  function loadDefaultPalette() {
    const defaultPalette = copyPalette(DEFAULT_THEME_PALETTES[editingMode]);
    setDrafts((current) => ({ ...current, [editingMode]: defaultPalette }));
    setPreviewPalettes((current) => ({
      ...current,
      [editingMode]: copyPalette(defaultPalette),
    }));
    setDefaultDrafts((current) => ({ ...current, [editingMode]: true }));
    setStatusMessage(
      `已載入${currentModeLabel}預設色，按「套用此模式」後才會保存。`,
    );
  }

  async function applyPalette() {
    if (!canApply) return;

    setSaving(true);
    setStatusMessage('');
    const restoringDefault =
      defaultDrafts[editingMode] &&
      themePalettesMatch(draft, DEFAULT_THEME_PALETTES[editingMode]);

    try {
      const result = restoringDefault
        ? resetPalette(editingMode)
        : await savePalette(editingMode, copyPalette(draft));

      if (result === 'invalid') {
        setStatusMessage('配色未通過驗證，請修正後再套用。');
        return;
      }

      setDefaultDrafts((current) => ({ ...current, [editingMode]: false }));

      if (result === 'saved') {
        const activeMode = mode === editingMode;
        const title = restoringDefault
          ? `已恢復${currentModeLabel}預設配色`
          : activeMode
            ? `已套用${currentModeLabel}配色`
            : `已儲存${currentModeLabel}配色`;
        const description = activeMode
          ? '配色已立即套用，並保存在目前瀏覽器。'
          : `切換到${currentModeLabel}時會自動套用。`;
        setStatusMessage(`${title}。${description}`);
        notify(title, description);
      } else {
        const description = storageFailureDescription(result);
        setStatusMessage(`配色已更新，但無法保存。${description}`);
      }
    } catch {
      const description = storageFailureDescription('unavailable');
      setStatusMessage(`配色已更新，但無法保存。${description}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>配色設定｜建築師考試</title>
      </Head>
      <section className={styles.page} aria-labelledby="appearance-title">
        <header className={styles.hero}>
          <span className={styles.heroIcon} aria-hidden="true">
            <IconPalette size={28} stroke={2} />
          </span>
          <div>
            <span className={styles.eyebrow}>APPEARANCE</span>
            <h2 id="appearance-title">配色設定</h2>
            <p>
              從官方配色快速開始，也能分別微調淺色與深色模式。通過可讀性檢查後，配色會保存在目前瀏覽器。
            </p>
          </div>
        </header>

        <fieldset
          className={styles.modeFieldset}
          aria-describedby="appearance-mode-help"
          aria-busy={!hydrated}
        >
          <legend>選擇要編輯的模式</legend>
          <p id="appearance-mode-help">
            這裡只會切換編輯與預覽的配色，不會改變網站目前使用的模式。
          </p>
          <div className={styles.modeOptions}>
            {modes.map((option) => {
              const selected = editingMode === option.mode;
              const customized = Boolean(customPalettes[option.mode]);
              const appliedPreset = findOfficialThemePreset(
                option.mode,
                palettes[option.mode],
              );
              const Icon = option.mode === 'light' ? IconSun : IconMoonStars;

              return (
                <label
                  className={styles.modeOption}
                  data-selected={selected || undefined}
                  key={option.mode}
                >
                  <input
                    type="radio"
                    name="appearance-mode"
                    value={option.mode}
                    aria-label={option.label}
                    checked={selected}
                    disabled={!hydrated}
                    onChange={() => selectMode(option.mode)}
                  />
                  <span className={styles.modeIcon} aria-hidden="true">
                    <Icon size={21} stroke={2} />
                  </span>
                  <span className={styles.modeText}>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className={styles.modeState}>
                    {appliedPreset?.name ?? (customized ? '自訂配色' : '使用預設')}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section
          className={styles.presetPanel}
          aria-labelledby="official-presets-title"
          aria-describedby="official-presets-help"
          aria-busy={!hydrated}
        >
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>OFFICIAL COLLECTION</span>
              <h3 id="official-presets-title">
                {currentModeLabel}・本站官方配色
              </h3>
            </div>
            <span className={styles.presetCount}>5 組精選</span>
          </div>
          <p className={styles.presetHelp} id="official-presets-help">
            選擇色票會立即更新下方獨立預覽；確認後再按「套用此模式」，不會意外改變整個網站。
          </p>

          <div
            className={styles.presetGrid}
            role="radiogroup"
            aria-label={`${currentModeLabel}本站官方配色`}
          >
            {OFFICIAL_THEME_PRESETS[editingMode].map((preset) => {
              const selected = selectedOfficialPreset?.id === preset.id;
              const applied = appliedOfficialPreset?.id === preset.id;
              const presetState = applied
                ? mode === editingMode
                  ? '使用中'
                  : '已設定'
                : selected
                  ? '預覽中'
                  : '官方';

              return (
                <label
                  className={styles.presetCard}
                  data-selected={selected || undefined}
                  key={preset.id}
                >
                  <input
                    type="radio"
                    name={`official-preset-${editingMode}`}
                    value={preset.id}
                    checked={selected}
                    disabled={!hydrated}
                    onChange={() => loadOfficialPreset(preset)}
                    aria-label={`${preset.name}：${preset.description}，${presetState}`}
                  />
                  <span className={styles.presetCardHeader}>
                    <strong>{preset.name}</strong>
                    <span
                      className={styles.presetBadge}
                      data-selected={selected || applied || undefined}
                    >
                      {selected || applied ? (
                        <>
                          <IconCheck size={12} stroke={2.5} aria-hidden="true" />
                          {presetState}
                        </>
                      ) : (
                        <>
                          <IconSparkles size={12} stroke={2} aria-hidden="true" />
                          官方
                        </>
                      )}
                    </span>
                  </span>
                  <span className={styles.presetDescription}>
                    {preset.description}
                  </span>
                  <span className={styles.presetSwatches} aria-hidden="true">
                    {colorFields.map(({ key }) => (
                      <span
                        key={key}
                        style={{ backgroundColor: preset.palette[key] }}
                      />
                    ))}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.editor} aria-labelledby="palette-editor-title">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>COLOR TOKENS</span>
                <h3 id="palette-editor-title">{currentModeLabel}色彩</h3>
              </div>
              <span className={styles.currentBadge}>
                {mode === editingMode ? '目前使用中' : '非目前模式'}
              </span>
            </div>

            <div className={styles.colorList} id="color-controls">
              {colorFields.map((field) => {
                const value = draft[field.key];
                const invalid = invalidKeys.includes(field.key);
                const errorId = `${editingMode}-${field.key}-error`;
                const nativeColor = isHexColor(value)
                  ? value
                  : previewPalettes[editingMode][field.key];

                return (
                  <div className={styles.colorField} key={field.key}>
                    <div className={styles.colorLabel}>
                      <label htmlFor={`${editingMode}-${field.key}-hex`}>
                        {field.label}
                      </label>
                      <span>{field.description}</span>
                    </div>
                    <label className={styles.swatch}>
                      <span className={styles.visuallyHidden}>
                        選擇{field.label}顏色
                      </span>
                      <input
                        type="color"
                        value={nativeColor}
                        disabled={!hydrated}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateColor(field.key, event.target.value)
                        }
                        aria-label={`選擇${field.label}顏色`}
                      />
                    </label>
                    <input
                      id={`${editingMode}-${field.key}-hex`}
                      className={styles.hexInput}
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={7}
                      pattern="#[0-9A-Fa-f]{6}"
                      value={value}
                      disabled={!hydrated}
                      onChange={(event) => updateColor(field.key, event.target.value)}
                      aria-label={`${field.label}十六進位色碼`}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? errorId : undefined}
                    />
                    {invalid ? (
                      <span className={styles.fieldError} id={errorId}>
                        請輸入完整色碼，例如 #1A2B3C。
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              className={styles.validation}
              id="palette-validation-status"
              role="status"
              aria-live="polite"
            >
              {!syntaxValid ? (
                <div className={styles.validationError}>
                  <IconAlertTriangle size={18} stroke={2} aria-hidden="true" />
                  <span>請先將所有色碼填成完整的 #RRGGBB 格式。</span>
                </div>
              ) : validation.issues.length ? (
                <div className={styles.validationError}>
                  <IconAlertTriangle size={18} stroke={2} aria-hidden="true" />
                  <div>
                    <strong>這組配色仍有可讀性問題：</strong>
                    <ul>
                      {validation.issues.map((issue) => (
                        <li key={`${issue.foreground}-${issue.background}`}>
                          {contrastPairLabel(issue)}對比為{' '}
                          {issue.ratio.toFixed(2)}:1，至少需要{' '}
                          {issue.minimum.toFixed(1)}:1。
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className={styles.validationSuccess}>
                  <IconCheck size={18} stroke={2.5} aria-hidden="true" />
                  <span>文字與重點色皆通過可讀性檢查。</span>
                </div>
              )}
              {statusMessage ? <p>{statusMessage}</p> : null}
            </div>

            <div className={styles.actions}>
              <Button type="button" disabled={!hydrated} onClick={loadDefaultPalette}>
                載入預設色
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canApply}
                aria-describedby="palette-validation-status"
                onClick={applyPalette}
              >
                {saving ? '正在套用…' : '套用此模式'}
              </Button>
            </div>
          </section>

          <section
            className={styles.previewPanel}
            aria-labelledby="palette-preview-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>LIVE PREVIEW</span>
                <h3 id="palette-preview-title">獨立預覽</h3>
              </div>
              <span className={styles.previewMode}>{currentModeLabel}</span>
            </div>
            <p className={styles.previewHint}>
              預覽只使用格式完整的草稿；不會在按下套用前改變網站配色。
            </p>

            <div
              className={styles.previewCanvas}
              style={previewStyle}
              role="region"
              aria-label={`${currentModeLabel}配色預覽`}
            >
              <aside className={styles.previewSidebar}>
                <div className={styles.previewBrand}>
                  <span aria-hidden="true">建</span>
                  <div>
                    <strong>建築師考試</strong>
                    <small>ARCHITECT EXAM</small>
                  </div>
                </div>
                <nav aria-label="預覽側欄">
                  <span className={styles.previewNavActive}>歷屆試題</span>
                  <span>考題分析</span>
                  <span>閱讀設定</span>
                </nav>
              </aside>
              <div className={styles.previewMain}>
                <div className={styles.previewTopbar}>
                  <span>建築法規與實務</span>
                  <span className={styles.previewPill}>114 年</span>
                </div>
                <article className={styles.previewCard}>
                  <span className={styles.previewKicker}>QUESTION 01</span>
                  <h4>這是一張使用自訂配色的內容卡片</h4>
                  <p>
                    主要文字會用於標題、題目與需要清楚閱讀的正文內容。
                  </p>
                  <p className={styles.previewMuted}>
                    次要文字適合補充說明、來源與不需要優先注意的資訊。
                  </p>
                  <div className={styles.previewControls}>
                    <span className={styles.previewLink}>查看重點連結</span>
                    <span className={styles.previewButton}>主要按鈕</span>
                  </div>
                </article>
                <div className={styles.previewSecondary}>
                  次層卡片會由核心色自動產生，並保留清楚邊框。
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
