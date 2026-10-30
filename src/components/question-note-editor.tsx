import { useState } from 'react';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import {
  appendImageFiles,
  AttachmentGallery,
  ImageAttachments,
} from '@/components/image-attachments';
import { DifficultButton } from '@/components/difficult-button';
import { QuestionPrompt, QuestionSourceLine, Tag } from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { RichText } from '@/components/rich-text';
import { SimilarQuestions } from '@/components/similar-questions';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Button, ConfirmDialog, useToast } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import { useDiscussionPublisher } from '@/lib/shared-discussions';
import { formatQuestionNumberLabel, getQuestionDisplayCategories } from '@/lib/study';
import { stripTextFormatting } from '@/lib/text-formatting';
import type { ImageAttachment, Question } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './question-note-editor.module.css';

export interface QuestionNoteDraft {
  content: string;
  images: ImageAttachment[];
}

/**
 * The note editor shared by 我的筆記 and the 筆記 tab of 考古題討論版. The page keeps the
 * unsaved draft (keyed by question id) and hands it back in; without a draft the saved note
 * is shown. Frameless: the page's panel draws the frame.
 */
export function QuestionNoteEditor({
  question,
  questions,
  draft,
  onDraftChange,
  header = 'full',
  showDifficultButton = true,
  showSimilarQuestions = true,
  onShared,
}: {
  question: Question;
  /** The bank the similar-question list searches; only needed with `showSimilarQuestions`. */
  questions?: readonly Question[];
  draft?: QuestionNoteDraft;
  onDraftChange: (draft: QuestionNoteDraft) => void;
  /** full: tags, source, number, prompt and answer rows; compact: number and prompt only. */
  header?: 'full' | 'compact';
  showDifficultButton?: boolean;
  showSimilarQuestions?: boolean;
  onShared?: () => void;
}) {
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const discussion = useDiscussionPublisher(question.id);
  const [sharing, setSharing] = useState(false);
  const content = draft?.content ?? state.notes[question.id] ?? '';
  const images = draft?.images ?? state.noteImages[question.id] ?? [];
  const hasSavedNote = Boolean(
    state.notes[question.id]?.trim() || state.noteImages[question.id]?.length,
  );
  const [editing, setEditing] = useState(!hasSavedNote);

  function saveNote() {
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    setEditing(!(content.trim() || images.length));
    notify(content.trim() || images.length ? '筆記已儲存' : '筆記已刪除');
  }

  async function shareNote() {
    if (sharing) return;
    const trimmed = content.trim();
    if (!trimmed && !images.length) {
      notify('尚無可分享的筆記', undefined, 'info');
      return;
    }
    dispatch({ type: 'save-note', questionId: question.id, content, images });
    setSharing(true);
    try {
      const result = await discussion.publish('explanation', content, images);
      notify(
        '已分享到考古題討論版',
        discussion.enabled && images.length
          ? result.imagesShared
            ? '文字與圖片已同步共享。'
            : '文字已共享；圖片僅保存在本機筆記。'
          : undefined,
        discussion.enabled && images.length && !result.imagesShared ? 'info' : 'success',
      );
      onShared?.();
    } catch (reason) {
      notify(
        '分享失敗',
        reason instanceof Error ? reason.message : '請稍後再試。',
        'error',
      );
    } finally {
      setSharing(false);
    }
  }

  function deleteNote() {
    dispatch({
      type: 'save-note',
      questionId: question.id,
      content: '',
      images: [],
    });
    onDraftChange({ content: '', images: [] });
    setEditing(true);
    notify('筆記已刪除');
  }

  return (
    <div className={styles.editor}>
      {header === 'full' ? (
        <>
          <div className={styles.questionMeta}>
            <Tag>{question.year} 年</Tag>
            <Tag tone="green">{getSubject(question.subject)?.name}</Tag>
            {getQuestionDisplayCategories(question).map((category) => (
              <Tag tone="orange" key={category}>
                {category}
              </Tag>
            ))}
            {question.format === 'written' ? <Tag tone="purple">申論題</Tag> : null}
            {question.source.kind === 'sample' ? <Tag tone="purple">示範題</Tag> : null}
          </div>
          <QuestionSourceLine question={question} />
        </>
      ) : null}
      <h2 className={styles.questionNumber}>{formatQuestionNumberLabel(question)}</h2>
      <QuestionPrompt question={question} compact={header === 'compact'} />
      {header === 'full' && question.format !== 'written' ? (
        <QuestionAnswerPanel question={question} heading={null} ariaLabel="題目選項" />
      ) : null}
      {editing ? (
        <>
          <div className={styles.noteToolbar}>
            <label htmlFor="question-note">我的筆記</label>
          </div>
          <RichTextEditor
            id="question-note"
            ariaLabel="我的筆記"
            value={content}
            onChange={(nextContent) => onDraftChange({ content: nextContent, images })}
            minHeight={240}
            onPasteImages={(files) => {
              void appendImageFiles(images, files).then((result) => {
                onDraftChange({ content, images: result.images });
                const pasted = result.images.length > images.length;
                notify(
                  pasted ? '已貼上筆記圖片' : '無法貼上圖片',
                  result.error || undefined,
                  pasted ? (result.error ? 'info' : 'success') : 'error',
                );
              });
            }}
            placeholder="記下法條、公式、易錯觀念或解題步驟，也可以直接貼上截圖…"
          />
          <ImageAttachments
            images={images}
            onChange={(nextImages) => onDraftChange({ content, images: nextImages })}
            label="上傳筆記圖片"
          />
        </>
      ) : (
        <section className={styles.noteResult} aria-label="已儲存筆記內容">
          {content.trim() ? (
            <p>
              <RichText>{content}</RichText>
            </p>
          ) : null}
          <AttachmentGallery images={images} />
        </section>
      )}
      <div className={styles.editorFooter}>
        <span>{stripTextFormatting(content).length} 字</span>
        <div>
          {showDifficultButton && question.format !== 'written' ? (
            <DifficultButton
              active={state.difficultQuestionIds.includes(question.id)}
              onClick={() =>
                dispatch({
                  type: 'toggle-difficult',
                  questionId: question.id,
                })
              }
            />
          ) : null}
          {hasSavedNote ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  <IconTrash size={16} stroke={2} aria-hidden="true" />
                  刪除筆記
                </Button>
              }
              title={`刪除第 ${question.questionNumber} 題筆記？`}
              description="文字與上傳的筆記圖片都會刪除，且無法復原。"
              confirmLabel="確認刪除"
              onConfirm={deleteNote}
            />
          ) : null}
          <Button disabled={sharing} onClick={() => void shareNote()}>
            {sharing ? '正在分享…' : '分享到考古題討論版'}
          </Button>
          {editing ? (
            <Button variant="primary" onClick={saveNote}>
              儲存筆記
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setEditing(true)}>
              <IconPencil size={16} stroke={2} aria-hidden="true" />
              編輯筆記
            </Button>
          )}
        </div>
      </div>
      {showSimilarQuestions && questions ? (
        <SimilarQuestions question={question} questions={questions} basePath="/notes" />
      ) : null}
    </div>
  );
}
