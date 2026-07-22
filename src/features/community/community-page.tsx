import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IconArrowLeft,
  IconArrowRight,
  IconHeart,
  IconHelpCircle,
  IconMessageCircle,
} from '@tabler/icons-react';
import { DifficultButton, EmptyState, PageHeader, Tag } from '@/components/content/content';
import { Button, SimpleSelect, useToast } from '@/components/ui/ui';
import { getQuestion, getSubject, questions, subjects } from '@/data/questions';
import type { DiscussionPostType, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './community-page.module.css';

const postTypeLabels: Record<DiscussionPostType, string> = {
  explanation: '題目詳解',
  supplement: '觀念補充',
  question: '提問',
  correction: '答案勘誤',
};

const postTypeOptions = Object.entries(postTypeLabels).map(([value, label]) => ({
  value: value as DiscussionPostType,
  label,
}));

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(iso: string) {
  const taipeiTime = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  const [date, time] = taipeiTime.toISOString().slice(0, 16).split('T');
  return `${date.replaceAll('-', '/')} ${time}`;
}

export function CommunityPage() {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const requestedQuestion = getQuestion(valueOf(router.query.question) ?? '');
  const currentQuestion = requestedQuestion ?? questions[0];
  const [postType, setPostType] = useState<DiscussionPostType>('explanation');
  const [postContent, setPostContent] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  if (!currentQuestion) {
    return <EmptyState icon={IconHelpCircle} title="題庫尚無資料" description="加入題目後即可使用詳解與討論。" />;
  }

  const subject = getSubject(currentQuestion.subject);
  const subjectQuestions = questions
    .filter((question) => question.subject === currentQuestion.subject)
    .sort(
      (left, right) =>
        right.year - left.year || left.questionNumber - right.questionNumber,
    );
  const availableYears = [...new Set(subjectQuestions.map((question) => question.year))].sort((a, b) => b - a);
  const paperQuestions = questions
    .filter(
      (question) =>
        question.subject === currentQuestion.subject && question.year === currentQuestion.year,
    )
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const currentIndex = subjectQuestions.findIndex((question) => question.id === currentQuestion.id);
  const posts = state.discussionPosts.filter((post) => post.questionId === currentQuestion.id);
  const difficult = state.difficultQuestionIds.includes(currentQuestion.id);

  function navigateTo(questionId: string) {
    void router.replace(
      { pathname: '/community', query: { question: questionId } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function selectSubject(subjectId: SubjectId) {
    const first = questions.find((question) => question.subject === subjectId);
    if (first) navigateTo(first.id);
  }

  function selectYear(year: string) {
    const first = questions.find(
      (question) => question.subject === currentQuestion.subject && question.year === Number(year),
    );
    if (first) navigateTo(first.id);
  }

  function addPost(event: FormEvent) {
    event.preventDefault();
    const content = postContent.trim();
    if (!content) return;
    const now = new Date().toISOString();
    dispatch({
      type: 'add-discussion-post',
      post: {
        id: `post-${now}-${Math.random().toString(36).slice(2, 7)}`,
        questionId: currentQuestion.id,
        type: postType,
        content,
        createdAt: now,
        likes: 0,
        replies: [],
        reported: false,
      },
    });
    setPostContent('');
    notify('已匿名投稿', '內容已保存在目前瀏覽器。');
  }

  function addReply(postId: string, event: FormEvent) {
    event.preventDefault();
    const content = replyDrafts[postId]?.trim();
    if (!content) return;
    dispatch({
      type: 'add-discussion-reply',
      postId,
      reply: {
        id: `reply-${new Date().toISOString()}-${Math.random().toString(36).slice(2, 7)}`,
        content,
        createdAt: new Date().toISOString(),
      },
    });
    setReplyDrafts((current) => ({ ...current, [postId]: '' }));
  }

  return (
    <>
      <PageHeader
        eyebrow="QUESTION REVIEW"
        title="詳解與匿名討論"
        description="先選科目、年份與題號，再查看完整題目與本裝置上的匿名內容。"
      />
      <section className={styles.selectorCard} aria-label="題目選擇">
        <SimpleSelect
          label="科目"
          value={currentQuestion.subject}
          options={subjects.map((item) => ({ value: item.id, label: item.name }))}
          onValueChange={selectSubject}
        />
        <SimpleSelect
          label="年份"
          value={String(currentQuestion.year)}
          options={availableYears.map((year) => ({ value: String(year), label: `${year} 年` }))}
          onValueChange={selectYear}
        />
        <SimpleSelect
          label="題號"
          value={currentQuestion.id}
          options={paperQuestions.map((question) => ({ value: question.id, label: `第 ${question.questionNumber} 題` }))}
          onValueChange={navigateTo}
        />
      </section>

      <section className={styles.questionCard}>
        <header>
          <div className={styles.tags}>
            <Tag tone="green">{subject?.name}</Tag>
            <Tag>{currentQuestion.year} 年</Tag>
            <Tag tone="purple">第 {currentQuestion.questionNumber} 題</Tag>
          </div>
          <DifficultButton
            active={difficult}
            onClick={() => dispatch({ type: 'toggle-difficult', questionId: currentQuestion.id })}
          />
        </header>
        <h2>{currentQuestion.text}</h2>
        <ol className={styles.options}>
          {currentQuestion.options.map((option, index) => (
            <li key={option} data-correct={index === currentQuestion.answer}>
              <span>{String.fromCharCode(65 + index)}</span>{option}
            </li>
          ))}
        </ol>
        <div className={styles.explanation}>
          <span>正確答案</span>
          <strong>{String.fromCharCode(65 + currentQuestion.answer)}・{currentQuestion.options[currentQuestion.answer]}</strong>
          <p>{currentQuestion.explanation}</p>
        </div>
        <footer className={styles.questionNavigation}>
          <Button
            disabled={currentIndex <= 0}
            onClick={() => subjectQuestions[currentIndex - 1] && navigateTo(subjectQuestions[currentIndex - 1].id)}
          >
            <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
          </Button>
          <Button
            variant="ghost"
            render={<Link href={`/quiz?subject=${currentQuestion.subject}&year=${currentQuestion.year}`} />}
          >
            返回作答頁
          </Button>
          <Button
            disabled={currentIndex >= subjectQuestions.length - 1}
            onClick={() => subjectQuestions[currentIndex + 1] && navigateTo(subjectQuestions[currentIndex + 1].id)}
          >
            下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
          </Button>
        </footer>
      </section>

      <div className={styles.discussionLayout}>
        <section className={styles.postsCard}>
          <header className={styles.sectionHeader}>
            <div><span>DISCUSSION</span><h2>匿名內容</h2></div>
            <strong>{posts.length} 則</strong>
          </header>
          {posts.length ? (
            <div className={styles.postList}>
              {posts.map((post) => (
                <article className={styles.post} key={post.id}>
                  <header>
                    <Tag tone={post.type === 'correction' ? 'orange' : 'purple'}>{postTypeLabels[post.type]}</Tag>
                    <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                  </header>
                  <p>{post.content}</p>
                  {post.replies.length ? (
                    <div className={styles.replies}>
                      {post.replies.map((reply) => (
                        <div key={reply.id}><span>匿名回覆・{formatDate(reply.createdAt)}</span><p>{reply.content}</p></div>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.postActions}>
                    <Button variant="ghost" onClick={() => dispatch({ type: 'like-discussion-post', postId: post.id })}>
                      <IconHeart size={17} stroke={2} aria-hidden="true" /> 讚 {post.likes}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={post.reported}
                      onClick={() => dispatch({ type: 'report-discussion-post', postId: post.id })}
                    >
                      {post.reported ? '已檢舉' : '檢舉'}
                    </Button>
                  </div>
                  <form className={styles.replyForm} onSubmit={(event) => addReply(post.id, event)}>
                    <label htmlFor={`reply-${post.id}`}>回覆這則內容</label>
                    <div>
                      <input
                        id={`reply-${post.id}`}
                        value={replyDrafts[post.id] ?? ''}
                        onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                        placeholder="輸入匿名回覆"
                      />
                      <Button type="submit">回覆</Button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={IconMessageCircle} title="還沒有內容" description="成為第一個留下詳解或提問的人。" />
          )}
        </section>

        <form className={styles.composeCard} onSubmit={addPost}>
          <span className={styles.composeEyebrow}>匿名投稿</span>
          <h2>分享解題觀念</h2>
          <SimpleSelect label="投稿類型" value={postType} options={postTypeOptions} onValueChange={setPostType} />
          <label htmlFor="post-content">內容</label>
          <textarea
            id="post-content"
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
            rows={8}
            placeholder="請清楚描述你的詳解、補充、提問或勘誤…"
          />
          <Button type="submit" variant="primary" fullWidth>匿名送出</Button>
          <p>目前沒有帳號系統，投稿內容僅儲存在這台裝置，不會同步給其他使用者。</p>
        </form>
      </div>
    </>
  );
}
