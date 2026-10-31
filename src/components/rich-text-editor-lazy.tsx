import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/ui';
import styles from './rich-text-editor.module.css';

/** While the editor's code is on its way, or why it never came. A reload also fetches a newer build. */
export function RichTextEditorLoading({ error }: { error?: Error | null }) {
  if (!error) return <p className={styles.loadingEditor}>正在準備編輯器…</p>;
  return (
    <div className={styles.loadingEditor} role="alert">
      <p>編輯器載入失敗，請確認連線後重新整理頁面。</p>
      <Button onClick={() => window.location.reload()}>重新整理</Button>
    </div>
  );
}

/**
 * tiptap is the largest thing on the question pages and nobody needs it to read a question, so
 * its code loads when an editor is first shown: 討論區, 筆記, or an opened review row. It still
 * renders on the server, so 我的筆記 keeps its static HTML.
 */
export const RichTextEditor = dynamic(
  () => import('./rich-text-editor').then((module) => module.RichTextEditor),
  { loading: RichTextEditorLoading },
);
