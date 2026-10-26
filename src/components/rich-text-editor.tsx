import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Extension, isNodeEmpty, type JSONContent } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, TextStyleKit } from '@tiptap/extension-text-style';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import {
  RICH_COLORS, RICH_FONT_SIZES, safeRichColor, safeRichFontSize, safeRichLink,
  serializeRichDocument, toRichDocument,
} from '@/lib/rich-document';
import styles from './rich-text-editor.module.css';

// Pasted HTML may offer arbitrary CSS; keep only the same safe attributes as saved documents.
const SafeColor = Color.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { color: {
      default: null,
      parseHTML: element => safeRichColor(element.style.color) ?? null,
      renderHTML: attributes => {
        const color = safeRichColor(attributes.color);
        return color ? { style: `color: ${color}` } : {};
      },
    } } }];
  },
});
const SafeFontSize = FontSize.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: {
      default: null,
      parseHTML: element => safeRichFontSize(element.style.fontSize) ?? null,
      renderHTML: attributes => {
        const size = safeRichFontSize(attributes.fontSize);
        return size ? { style: `font-size: ${size}` } : {};
      },
    } } }];
  },
});

/** One editor for notes and shared explanations: IME, history and selection belong to ProseMirror. */
export function RichTextEditor({
  value, onChange, ariaLabel, ariaContext = '', placeholder = '輸入筆記…',
  id, minHeight = 140, disabled = false, maxLength = 20000, onPasteImages,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  ariaContext?: string;
  placeholder?: string;
  id?: string;
  minHeight?: number;
  disabled?: boolean;
  /** Firestore limits the serialized string, not just its visible characters. */
  maxLength?: number;
  onPasteImages?: (files: File[]) => void;
}) {
  const autoId = useId();
  const warningId = `${autoId}-limit`;
  const lastValue = useRef(value);
  const callbacks = useRef({ onChange, onPasteImages });
  useEffect(() => { callbacks.current = { onChange, onPasteImages }; }, [onChange, onPasteImages]);
  const [atLimit, setAtLimit] = useState(false);
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false, code: false, codeBlock: false, horizontalRule: false,
      link: { openOnClick: false, isAllowedUri: url => Boolean(safeRichLink(url)) },
      trailingNode: false,
    }),
    TextStyleKit.configure({ backgroundColor: false, fontFamily: false, lineHeight: false, color: false, fontSize: false }),
    SafeColor, SafeFontSize,
    Superscript.extend({ excludes: 'subscript' }),
    Subscript.extend({ excludes: 'superscript' }),
    Extension.create({
      name: 'storageLimit',
      addProseMirrorPlugins: () => [new Plugin({
        filterTransaction(transaction, state) {
          if (!transaction.docChanged || transaction.getMeta('preventUpdate')) return true;
          const size = serializeRichDocument(transaction.doc.toJSON()).length;
          const allowed = size <= maxLength || size <= serializeRichDocument(state.doc.toJSON()).length;
          setAtLimit(!allowed);
          return allowed;
        },
      })],
    }),
  ], [maxLength]);
  const editor = useEditor({
    extensions,
    content: toRichDocument(value) as JSONContent,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      // Resolve emptiness from the actual document, including the first mount and
      // silent external resets, before React's editor-state subscription catches up.
      attributes: state => ({
        role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel, 'aria-disabled': String(disabled),
        'aria-invalid': String(atLimit), ...(atLimit ? { 'aria-describedby': warningId } : {}),
        'data-placeholder': placeholder, 'data-empty': String(isNodeEmpty(state.doc)), ...(id ? { id } : {}),
      }),
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter(file => file.type.startsWith('image/'));
        if (!files.length || !callbacks.current.onPasteImages) return false;
        callbacks.current.onPasteImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: current, transaction }) => {
      if (!transaction.docChanged) return;
      const next = serializeRichDocument(current.getJSON());
      lastValue.current = next;
      callbacks.current.onChange(next);
    },
  }, [maxLength]);
  const selection = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current?.isActive('bold'), italic: current?.isActive('italic'),
    underline: current?.isActive('underline'), strike: current?.isActive('strike'),
    superscript: current?.isActive('superscript'), subscript: current?.isActive('subscript'),
    bulletList: current?.isActive('bulletList'), orderedList: current?.isActive('orderedList'),
    color: safeRichColor(current?.getAttributes('textStyle').color) ?? '',
    size: safeRichFontSize(current?.getAttributes('textStyle').fontSize) ?? '',
    undo: current?.can().undo(), redo: current?.can().redo(),
  }) });

  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    editor.commands.setContent(toRichDocument(value) as JSONContent, { emitUpdate: false });
    lastValue.current = value;
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [disabled, editor]);

  const chain = () => editor?.chain().focus(undefined, { scrollIntoView: false });
  const actions = [
    { key: 'bold', label: '粗體', sample: <strong>B</strong>, run: () => chain()?.toggleBold().run() },
    { key: 'italic', label: '斜體', sample: <em>I</em>, run: () => chain()?.toggleItalic().run() },
    { key: 'underline', label: '底線', sample: <u>U</u>, run: () => chain()?.toggleUnderline().run() },
    { key: 'strike', label: '刪除線', sample: <s>S</s>, run: () => chain()?.toggleStrike().run() },
    { key: 'superscript', label: '上標', sample: <>X<sup>2</sup></>, run: () => chain()?.toggleSuperscript().run() },
    { key: 'subscript', label: '下標', sample: <>X<sub>2</sub></>, run: () => chain()?.toggleSubscript().run() },
    { key: 'bulletList', label: '項目清單', sample: '•', run: () => chain()?.toggleBulletList().run() },
    { key: 'orderedList', label: '編號清單', sample: '1.', run: () => chain()?.toggleOrderedList().run() },
  ] as const;
  const colorValue = selection?.color ?? '';
  const knownColor = !colorValue || RICH_COLORS.some(color => color.value === colorValue);
  return (
    <div className={styles.root} style={{ '--editor-min-height': `${minHeight}px` } as CSSProperties}>
      <div className={styles.toolbar} role="group" aria-label={`${ariaContext || '文字'}格式`}>
        {actions.map(action => (
          <button key={action.key} type="button" disabled={disabled || !editor}
            aria-label={`切換${ariaContext}選取文字的${action.label}格式`}
            aria-pressed={Boolean(selection?.[action.key])}
            onMouseDown={event => event.preventDefault()} onClick={action.run}>
            <span aria-hidden="true">{action.sample}</span><span>{action.label}</span>
          </button>
        ))}
        <label>字色
          <select aria-label={`${ariaContext}文字顏色`} disabled={disabled || !editor}
            value={knownColor ? colorValue : 'custom'} onChange={event => {
              if (event.target.value) chain()?.setColor(event.target.value).run();
              else chain()?.unsetColor().run();
            }}>
            <option value="">預設</option>
            {RICH_COLORS.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
            {!knownColor ? <option value="custom">自訂顏色</option> : null}
          </select>
        </label>
        <input type="color" className={styles.colorPicker} aria-label={`${ariaContext}自訂文字顏色`}
          disabled={disabled || !editor} value={colorValue.startsWith('#') ? colorValue : '#dc3545'}
          onChange={event => chain()?.setColor(event.target.value).run()} />
        <label>字級
          <select aria-label={`${ariaContext}文字大小`} value={selection?.size ?? ''} disabled={disabled || !editor}
            onChange={event => event.target.value ? chain()?.setFontSize(event.target.value).run() : chain()?.unsetFontSize().run()}>
            <option value="">預設</option>
            {selection?.size && !RICH_FONT_SIZES.includes(Number.parseInt(selection.size, 10))
              ? <option value={selection.size}>{selection.size}</option> : null}
            {RICH_FONT_SIZES.map(size => <option key={size} value={`${size}px`}>{size} px</option>)}
          </select>
        </label>
        <button type="button" disabled={disabled || !editor} onMouseDown={event => event.preventDefault()}
          onClick={() => chain()?.unsetAllMarks().clearNodes().run()}>清除格式</button>
        <button type="button" aria-label={`${ariaContext}復原`} disabled={disabled || !selection?.undo}
          onMouseDown={event => event.preventDefault()} onClick={() => chain()?.undo().run()}>復原</button>
        <button type="button" aria-label={`${ariaContext}重做`} disabled={disabled || !selection?.redo}
          onMouseDown={event => event.preventDefault()} onClick={() => chain()?.redo().run()}>重做</button>
      </div>
      <div className={styles.surface} data-disabled={disabled || undefined}
        aria-describedby={atLimit ? warningId : undefined}>
        <EditorContent editor={editor} />
      </div>
      {atLimit ? <small id={warningId} role="alert" className={styles.warning}>
        已達儲存長度上限（含格式 {maxLength.toLocaleString()} 字元），請刪減部分內容後再輸入。
      </small> : null}
    </div>
  );
}
