import {
  EmptyState,
  PageHeader,
  QuestionCard,
  QuestionPrompt,
  QuestionSourceLine,
} from '@/components/content/content';
import { IconBulb, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import type { Question } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './difficult-page.module.css';

export function DifficultPage({ questions }: { questions: Question[] }) {
  const { state, dispatch, hydrated } = useAppState();
  const difficultQuestions = questions.filter((question) =>
    state.difficultQuestionIds.includes(question.id),
  );

  return (
    <>
      <PageHeader
        eyebrow="DIFFICULT QUESTIONS"
        title="難題標記"
        description="集中複習所有以「已標記難題」保存的題目。"
      />
      <section className={styles.panel}>
        {!hydrated ? (
          <EmptyState icon={IconLoader2} title="正在讀取難題" description="請稍候。" />
        ) : difficultQuestions.length ? (
          <div className={styles.list}>
            {difficultQuestions.map((question) => (
              <article className={styles.difficultItem} key={question.id}>
                <QuestionCard
                  question={question}
                  difficult
                  onToggleDifficult={() =>
                    dispatch({ type: 'toggle-difficult', questionId: question.id })
                  }
                />
                <details className={styles.fullQuestion}>
                  <summary>
                    <span>查看完整題目與選項</span>
                    <IconChevronDown size={18} stroke={2} aria-hidden="true" />
                  </summary>
                  <div>
                    <QuestionPrompt question={question} />
                    <QuestionSourceLine question={question} />
                    <ol aria-label={`第 ${question.questionNumber} 題完整選項`}>
                      {question.options.map((option, index) => (
                        <li key={`${question.id}-${index}`}>
                          <b>{String.fromCharCode(65 + index)}</b>
                          <span>{option}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={IconBulb}
            title="還沒有標記難題"
            description="在作答頁、交卷結果或詳解頁按下「標記為難題」，題目就會出現在這裡。"
          />
        )}
      </section>
    </>
  );
}
