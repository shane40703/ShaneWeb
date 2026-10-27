import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscussionPost } from '@/lib/types';
import { QuestionExplanationContent } from './question-explanation-content';

const shared = vi.hoisted(() => ({ posts: [] as DiscussionPost[], loading: false, error: '', read: vi.fn() }));
vi.mock('@/lib/shared-discussions', () => ({ useSharedDiscussions: (id: string) => { shared.read(id); return shared; } }));
const question = { id: 'law-114-78', explanation: '' };
function post(type: DiscussionPost['type'], content: string): DiscussionPost {
  return { id: type, questionId: question.id, type, content, images: [], createdAt: '2026-10-27T00:00:00Z', likes: 0, replies: [], reported: false };
}
beforeEach(() => { shared.posts = []; shared.loading = false; shared.error = ''; shared.read.mockClear(); });
afterEach(cleanup);

describe('QuestionExplanationContent', () => {
  it('shows shared explanations, supplements, corrections and image-only posts with rich text', () => {
    const illustrated = post('supplement', '');
    illustrated.images = [{ id: 'illustration', name: '共享詳解圖片', type: 'image/png', dataUrl: 'data:image/png;base64,aGVsbG8=' }];
    shared.posts = [post('explanation', '**共享解題重點**'), illustrated, post('correction', '勘誤說明'), post('question', '這是一則提問')];
    render(<QuestionExplanationContent question={{ ...question, explanation: '內建詳解' }} />);
    expect(shared.read).toHaveBeenCalledWith(question.id);
    expect(screen.getByText('內建詳解')).toBeInTheDocument();
    expect(screen.getByText('共享解題重點').tagName).toBe('STRONG');
    expect(screen.getByRole('img', { name: '共享詳解圖片' })).toBeInTheDocument();
    expect(screen.getByText('勘誤說明')).toBeInTheDocument();
    expect(screen.queryByText('這是一則提問')).not.toBeInTheDocument();
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();
  });

  it('waits for the first shared snapshot instead of claiming no explanation', () => {
    shared.loading = true;
    const view = render(<QuestionExplanationContent question={question} />);
    expect(screen.getByRole('status')).toHaveTextContent('正在載入詳解與討論…');
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();
    shared.loading = false;
    shared.posts = [post('explanation', '雲端詳解已載入')];
    view.rerender(<QuestionExplanationContent question={question} />);
    expect(screen.getByText('雲端詳解已載入')).toBeInTheDocument();
    shared.posts = [post('explanation', '雲端詳解已修改')];
    view.rerender(<QuestionExplanationContent question={question} />);
    expect(screen.getByText('雲端詳解已修改')).toBeInTheDocument();
    expect(screen.queryByText('雲端詳解已載入')).not.toBeInTheDocument();
  });

  it('shows an explicit read failure without hiding the built-in text or claiming it is empty', () => {
    shared.error = '無法讀取共享投稿，請確認 Firestore 規則與網路連線。';
    render(<QuestionExplanationContent question={{ ...question, explanation: '仍可讀取的內建詳解' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(shared.error);
    expect(screen.getByText('仍可讀取的內建詳解')).toBeInTheDocument();
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();
  });

  it('uses the empty fallback only after loading and allows the practice-specific wording', () => {
    shared.posts = [post('question', '尚未有人解答的提問')];
    const view = render(<QuestionExplanationContent question={{ ...question, explanation: '  ' }} />);
    expect(screen.getByText('目前尚無詳解。')).toBeInTheDocument();
    view.rerender(<QuestionExplanationContent question={question} emptyMessage="請先比較正確選項" />);
    expect(screen.getByText('請先比較正確選項')).toBeInTheDocument();
  });
});
