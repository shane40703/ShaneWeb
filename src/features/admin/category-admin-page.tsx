import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconDeviceFloppy,
  IconExternalLink,
  IconKey,
  IconSearch,
  IconShieldLock,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { subjects, years } from '@/question-bank/catalog';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import { getQuestionDisplayCategories } from '@/lib/study';
import type { Question, QuestionSummary, SubjectId } from '@/lib/types';
import styles from './category-admin-page.module.css';

type ReviewFilter = 'needs-review' | 'all';

function needsReview(question: QuestionSummary) {
  return (
    question.primaryCategory === '其他' ||
    question.topic === '其他' ||
    (question.subject === 'law' && !question.relatedLaws?.length)
  );
}

export function CategoryAdminPage({
  questions: initialQuestions,
}: {
  questions: QuestionSummary[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [subjectId, setSubjectId] = useState<SubjectId>('law');
  const [year, setYear] = useState<number | 'all'>('all');
  const [reviewFilter, setReviewFilter] =
    useState<ReviewFilter>('needs-review');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('zh-TW');
    return questions.filter(
      (question) =>
        question.subject === subjectId &&
        (year === 'all' || question.year === year) &&
        (reviewFilter === 'all' ||
          needsReview(question) ||
          question.id === selectedId) &&
        (!query ||
          question.id.toLocaleLowerCase('zh-TW').includes(query) ||
          question.text.toLocaleLowerCase('zh-TW').includes(query)),
    );
  }, [questions, reviewFilter, search, selectedId, subjectId, year]);
  const selectedQuestion =
    filteredQuestions.find((question) => question.id === selectedId) ??
    filteredQuestions[0];
  const classificationOptions = useMemo(() => {
    const existing = questions
      .filter((question) => question.subject === subjectId)
      .flatMap(getQuestionDisplayCategories);
    const catalog = Object.entries(analysisCategoryCatalog[subjectId])
      .filter(([, topics]) => topics.length || existing.includes(topics[0] ?? ''))
      .map(([classification]) => classification);
    return [...new Set([...catalog, ...existing])].sort((left, right) =>
      left.localeCompare(right, 'zh-Hant'),
    );
  }, [questions, subjectId]);
  const [classifications, setClassifications] = useState<string[]>([]);
  const [classificationInput, setClassificationInput] = useState('');
  const [authorKey, setAuthorKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { tone: 'success' | 'error'; message: string } | undefined
  >();
  const editedQuestionId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      !selectedQuestion ||
      editedQuestionId.current === selectedQuestion.id
    ) {
      return;
    }
    editedQuestionId.current = selectedQuestion.id;
    setClassifications(getQuestionDisplayCategories(selectedQuestion));
    setClassificationInput('');
    setStatus(undefined);
  }, [selectedQuestion]);

  function addClassification(classification: string) {
    const normalized = classification.trim();
    if (!normalized) return;
    setClassifications((current) =>
      subjectId === 'law'
        ? [...new Set([...current, normalized])]
        : [normalized],
    );
    setClassificationInput('');
  }

  function removeClassification(classification: string) {
    setClassifications((current) =>
      current.filter((item) => item !== classification),
    );
  }

  async function saveClassification() {
    if (!selectedQuestion || !authorKey.trim()) {
      setStatus({ tone: 'error', message: '請先輸入作者編輯金鑰。' });
      return;
    }
    setSaving(true);
    setStatus(undefined);
    try {
      const response = await fetch('/api/admin/classification', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Author-Key': authorKey.trim(),
        },
        body: JSON.stringify({
          questionId: selectedQuestion.id,
          classifications,
        }),
      });
      const body = (await response.json()) as
        | { question: Question }
        | { error: string };
      if (!response.ok || !('question' in body)) {
        throw new Error('error' in body ? body.error : '分類更新失敗');
      }
      const updated = body.question;
      setSelectedId(selectedQuestion.id);
      setQuestions((current) =>
        current.map((question) =>
          question.id === updated.id
            ? {
                ...question,
                primaryCategory: updated.primaryCategory,
                topic: updated.topic,
                tags: updated.tags,
                relatedLaws: updated.relatedLaws,
              }
            : question,
        ),
      );
      setStatus({
        tone: 'success',
        message: '分類已驗證並寫回題庫 meta.json。',
      });
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : '分類更新失敗',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <span>AUTHOR TOOL</span>
          <h1>題目分類管理</h1>
          <p>
            人工檢核自動分類結果；儲存時會套用題庫 schema 驗證並寫回來源檔。
          </p>
        </div>
        <div className={styles.keyField}>
          <label htmlFor="author-key">
            <IconKey size={16} stroke={2} aria-hidden="true" />
            作者編輯金鑰
          </label>
          <input
            id="author-key"
            type="password"
            value={authorKey}
            onChange={(event) => setAuthorKey(event.target.value)}
            autoComplete="current-password"
          />
        </div>
      </header>

      <section className={styles.notice}>
        <IconShieldLock size={18} stroke={2} aria-hidden="true" />
        此工具供作者工作環境使用。伺服器須設定 <code>AUTHOR_EDIT_KEY</code>；
        修改後請檢查並提交題庫檔案。
      </section>

      <section className={styles.filters} aria-label="分類管理篩選">
        <label>
          科目
          <select
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value as SubjectId);
              setSelectedId(undefined);
            }}
          >
            {subjects.map((subject) => (
              <option value={subject.id} key={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          年度
          <select
            value={year}
            onChange={(event) => {
              setYear(
                event.target.value === 'all'
                  ? 'all'
                  : Number(event.target.value),
              );
              setSelectedId(undefined);
            }}
          >
            <option value="all">全部年度</option>
            {years.map((candidateYear) => (
              <option value={candidateYear} key={candidateYear}>
                {candidateYear} 年
              </option>
            ))}
          </select>
        </label>
        <label>
          檢核狀態
          <select
            value={reviewFilter}
            onChange={(event) => {
              setReviewFilter(event.target.value as ReviewFilter);
              setSelectedId(undefined);
            }}
          >
            <option value="needs-review">待檢核／未明確分類</option>
            <option value="all">全部題目</option>
          </select>
        </label>
        <label className={styles.searchField}>
          搜尋題號或題幹
          <span>
            <IconSearch size={17} stroke={2} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(undefined);
              }}
            />
          </span>
        </label>
      </section>

      <div className={styles.workspace}>
        <section className={styles.questionList}>
          <header>
            <span>檢核清單</span>
            <strong>{filteredQuestions.length} 題</strong>
          </header>
          <div>
            {filteredQuestions.length ? (
              filteredQuestions.map((question) => (
                <button
                  type="button"
                  key={question.id}
                  aria-pressed={question.id === selectedQuestion?.id}
                  onClick={() => setSelectedId(question.id)}
                >
                  <span>
                    {question.year} 年・第 {question.questionNumber} 題
                  </span>
                  <strong>{question.text}</strong>
                  <small>
                    {getQuestionDisplayCategories(question).join('、')}
                  </small>
                </button>
              ))
            ) : (
              <p>目前篩選範圍沒有待檢核題目。</p>
            )}
          </div>
        </section>

        <section className={styles.editor}>
          {selectedQuestion ? (
            <>
              <header>
                <div>
                  <span>{selectedQuestion.id}</span>
                  <h2>
                    {selectedQuestion.year} 年・第 {selectedQuestion.questionNumber}{' '}
                    題
                  </h2>
                </div>
                <Link
                  href={`${selectedQuestion.path}?mode=single`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看題目
                  <IconExternalLink size={15} stroke={2} aria-hidden="true" />
                </Link>
              </header>
              <p className={styles.questionText}>{selectedQuestion.text}</p>
              <div className={styles.editorFields}>
                <label>
                  題目分類{selectedQuestion.subject === 'law' ? '（可複選）' : ''}
                  {selectedQuestion.subject === 'law' ? (
                    <span className={styles.classificationPicker}>
                      <input
                        aria-label="輸入或選擇題目分類"
                        list="law-classification-options"
                        value={classificationInput}
                        onChange={(event) =>
                          setClassificationInput(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          addClassification(classificationInput);
                        }}
                        placeholder="選擇既有分類或輸入新法規名稱"
                      />
                      <datalist id="law-classification-options">
                        {classificationOptions
                          .filter(
                            (classification) =>
                              !classifications.includes(classification),
                          )
                          .map((classification) => (
                            <option value={classification} key={classification} />
                          ))}
                      </datalist>
                      <Button
                        type="button"
                        disabled={!classificationInput.trim()}
                        onClick={() => addClassification(classificationInput)}
                      >
                        新增分類
                      </Button>
                    </span>
                  ) : (
                    <select
                      aria-label="新增題目分類"
                      value=""
                      onChange={(event) => addClassification(event.target.value)}
                    >
                      <option value="">請選擇分類</option>
                      {classificationOptions.map((classification) => (
                        <option
                          value={classification}
                          key={classification}
                          disabled={classifications.includes(classification)}
                        >
                          {classification}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <div className={styles.classificationTags} aria-label="目前題目分類">
                  {classifications.length ? (
                    classifications.map((classification) => (
                      <span key={classification}>
                        {classification}
                        <button
                          type="button"
                          aria-label={`移除分類 ${classification}`}
                          onClick={() => removeClassification(classification)}
                        >
                          <IconX size={13} stroke={2.4} aria-hidden="true" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <p>尚未選擇分類</p>
                  )}
                </div>
              </div>
              <footer>
                {status ? (
                  <p data-tone={status.tone} role="status">
                    {status.message}
                  </p>
                ) : (
                  <span>尚未儲存的變更只保留在此頁。</span>
                )}
                <Button
                  variant="primary"
                  disabled={saving || !classifications.length}
                  onClick={saveClassification}
                >
                  <IconDeviceFloppy size={17} stroke={2} aria-hidden="true" />
                  {saving ? '儲存中…' : '驗證並儲存'}
                </Button>
              </footer>
            </>
          ) : (
            <div className={styles.emptyEditor}>
              <strong>沒有可編輯的題目</strong>
              <p>請調整科目、年度或檢核狀態。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
