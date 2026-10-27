import { AttachmentGallery } from '@/components/image-attachments';
import { RichText } from '@/components/rich-text';
import { useSharedDiscussions } from '@/lib/shared-discussions';
import type { Question } from '@/lib/types';

/** Read the same shared explanations as the discussion page, not just the bank. */
export function QuestionExplanationContent({
  question,
  emptyMessage = '目前尚無詳解。',
}: {
  question: Pick<Question, 'id' | 'explanation'>;
  emptyMessage?: string;
}) {
  const shared = useSharedDiscussions(question.id);
  const posts = shared.posts.filter(post =>
    ['explanation', 'supplement', 'correction'].includes(post.type),
  );
  const hasBuiltIn = Boolean(question.explanation?.trim());

  return <>
    {hasBuiltIn ? <p><RichText>{question.explanation!}</RichText></p> : null}
    {posts.map(post => <article key={post.id}>
      {post.content ? <p><RichText>{post.content}</RichText></p> : null}
      <AttachmentGallery images={post.images} />
    </article>)}
    {shared.loading ? <p role="status">正在載入詳解與討論…</p> : null}
    {shared.error ? <p role="alert">{shared.error}</p> : null}
    {!shared.loading && !shared.error && !hasBuiltIn && !posts.length
      ? <p>{emptyMessage}</p> : null}
  </>;
}
