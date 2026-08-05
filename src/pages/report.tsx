import Head from 'next/head';
import { useRouter } from 'next/router';
import { type FormEvent, useState } from 'react';
import { Button, useToast } from '@/components/ui/ui';
import type { ContentReport } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from '@/features/report/report-page.module.css';

const categories: ContentReport['category'][] = [
  '題目內容',
  '答案',
  '圖片',
  '詳解',
  '其他',
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReportPage() {
  const router = useRouter();
  const { dispatch } = useAppState();
  const { notify } = useToast();
  const [category, setCategory] = useState<ContentReport['category']>('題目內容');
  const [questionId, setQuestionId] = useState(
    valueOf(router.query.question) ?? '',
  );
  const [description, setDescription] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = description.trim();
    if (!content) return;
    const createdAt = new Date().toISOString();
    dispatch({
      type: 'add-content-report',
      report: {
        id: `report-${createdAt}`,
        pageUrl:
          typeof window === 'undefined'
            ? ''
            : valueOf(router.query.from) ?? window.location.href,
        questionId: questionId.trim(),
        category,
        description: content,
        createdAt,
      },
    });
    setDescription('');
    notify('問題已回報', '管理者可在留言管理後台查看此瀏覽器的回報。');
  }

  return (
    <>
      <Head><title>問題回報｜建築師考試</title></Head>
      <section className={styles.page}>
        <form onSubmit={submit}>
          <label>
            問題類型
            <select value={category} onChange={(event) => setCategory(event.target.value as ContentReport['category'])}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            題目編號（選填）
            <input value={questionId} onChange={(event) => setQuestionId(event.target.value)} placeholder="例如 law-114-01" />
          </label>
          <label className={styles.description}>
            問題說明
            <textarea required rows={8} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="請描述錯誤位置與建議修正內容…" />
          </label>
          <Button variant="primary" disabled={!description.trim()} type="submit">送出問題回報</Button>
        </form>
        <p className={styles.notice}>
          目前網站採免登入、本機保存；回報會保存在此瀏覽器，管理者可由同一瀏覽器的後台檢視。
        </p>
      </section>
    </>
  );
}
