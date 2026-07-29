import Head from 'next/head';
import { useState } from 'react';
import { IconMessageCircle, IconTrash } from '@tabler/icons-react';
import { Button, ConfirmDialog } from '@/components/ui/ui';
import { formatDateTime } from '@/lib/study';
import { useAppState } from '@/state/app-state';
import styles from '@/features/admin/discussion-admin-page.module.css';

export default function DiscussionAdminPage() {
  const { state, dispatch } = useAppState();
  const [key, setKey] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function verify() {
    setChecking(true);
    setError('');
    try {
      const response = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '驗證失敗');
      setAuthorized(true);
      setKey('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '驗證失敗');
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Head><title>留言管理｜建築師考試</title></Head>
      <section className={styles.page}>
        <header>
          <IconMessageCircle size={26} stroke={2} aria-hidden="true" />
          <div><span>AUTHOR ADMIN</span><h1>詳解與討論留言管理</h1><p>管理目前瀏覽器保存的匿名留言與回覆。</p></div>
        </header>
        {!authorized ? (
          <section className={styles.login}>
            <label htmlFor="discussion-admin-key">AUTHOR_EDIT_KEY</label>
            <input id="discussion-admin-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} />
            <Button variant="primary" disabled={!key || checking} onClick={verify}>
              {checking ? '驗證中…' : '進入留言管理'}
            </Button>
            {error ? <p role="alert">{error}</p> : null}
          </section>
        ) : (
          <section className={styles.posts}>
            <header><strong>{state.discussionPosts.length} 則留言</strong><Button onClick={() => setAuthorized(false)}>鎖定後台</Button></header>
            {state.discussionPosts.length ? state.discussionPosts.map((post) => (
              <article key={post.id}>
                <div><span>{post.questionId}・{formatDateTime(post.createdAt)}</span><p>{post.content || `圖片留言 ${post.images.length} 張`}</p></div>
                <ConfirmDialog
                  trigger={<Button variant="danger"><IconTrash size={16} aria-hidden="true" />刪除留言</Button>}
                  title="刪除這則留言？"
                  description="留言及其所有回覆會從目前瀏覽器永久移除。"
                  confirmLabel="確認刪除"
                  onConfirm={() => dispatch({ type: 'delete-discussion-post', postId: post.id })}
                />
                {post.replies.map((reply) => (
                  <div className={styles.reply} key={reply.id}>
                    <span>回覆・{formatDateTime(reply.createdAt)}</span><p>{reply.content}</p>
                    <Button variant="danger" onClick={() => dispatch({ type: 'delete-discussion-reply', postId: post.id, replyId: reply.id })}>刪除回覆</Button>
                  </div>
                ))}
              </article>
            )) : <p className={styles.empty}>目前瀏覽器沒有留言。</p>}
          </section>
        )}
      </section>
    </>
  );
}
