import Head from 'next/head';
import { useRouter } from 'next/router';
import { type FormEvent, useState } from 'react';
import { Button, useToast } from '@/components/ui/ui';
import { useCloudSync } from '@/components/cloud-sync-provider';
import { firebaseConfigurationAvailable } from '@/lib/firebase-client';
import { addSharedContentReport } from '@/lib/shared-content-reports';
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
  const cloud = useCloudSync();
  const sharedReportsEnabled = firebaseConfigurationAvailable();
  const [category, setCategory] = useState<ContentReport['category']>('題目內容');
  const [questionId, setQuestionId] = useState(
    valueOf(router.query.question) ?? '',
  );
  const [description, setDescription] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = description.trim();
    if (!content) return;
    const report = {
      pageUrl: typeof window === 'undefined' ? '' : valueOf(router.query.from) ?? window.location.href,
      questionId: questionId.trim(),
      category,
      description: content,
    };
    try {
      if (sharedReportsEnabled) {
        if (!cloud.user) throw new Error('請先使用 Google 登入後再送出回報。');
        await addSharedContentReport(report, cloud.user.uid);
      } else {
        const createdAt = new Date().toISOString();
        dispatch({
          type: 'add-content-report',
          report: { ...report, id: `report-${createdAt}`, createdAt },
        });
      }
      setDescription('');
      notify('問題已回報', sharedReportsEnabled ? '回報已送至雲端，後端工程師可統一查看。' : '回報已保存在目前瀏覽器。');
    } catch (reason) {
      notify('回報失敗', reason instanceof Error ? reason.message : '請稍後再試。');
    }
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
          {sharedReportsEnabled && !cloud.user ? (
            <Button type="button" onClick={() => void cloud.signIn()}>使用 Google 登入</Button>
          ) : null}
          <Button variant="primary" disabled={!description.trim() || (sharedReportsEnabled && !cloud.user)} type="submit">送出問題回報</Button>
        </form>
        <p className={styles.notice}>
          {sharedReportsEnabled
            ? '登入後送出的回報會集中保存於 Firebase，供後端工程師統一查看與處理。'
            : 'Firebase 尚未設定，回報只會保存在目前瀏覽器。'}
        </p>
      </section>
    </>
  );
}
