import { EmptyState, PageHeader, QuestionCard } from '@/components/content/content';
import { IconBulb, IconLoader2 } from '@tabler/icons-react';
import { questions } from '@/data/questions';
import { useAppState } from '@/state/app-state';
import styles from './difficult-page.module.css';

export function DifficultPage() {
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
              <QuestionCard
                key={question.id}
                question={question}
                difficult
                onToggleDifficult={() =>
                  dispatch({ type: 'toggle-difficult', questionId: question.id })
                }
              />
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
