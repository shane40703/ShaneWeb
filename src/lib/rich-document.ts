/** Versioned, allow-listed rich text stored in the existing string field, not executable HTML. */
export const RICH_DOCUMENT_PREFIX = 'shaneweb:richtext:v1:';
export const RICH_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40];
export const RICH_COLORS = [
  { label: '紅色', value: 'var(--danger)' },
  { label: '橙色', value: 'var(--warning)' },
  { label: '綠色', value: 'var(--success)' },
  { label: '藍色', value: 'var(--primary)' },
  { label: '紫色', value: '#a875df' },
  { label: '灰色', value: 'var(--muted)' },
];

export interface RichMark { type: string; attrs?: Record<string, string> }
export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, string | number>;
  marks?: RichMark[];
  content?: RichNode[];
}

export function safeRichColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  if (RICH_COLORS.some(color => color.value === value)) return value;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map(c => c + c).join('')}`.toLowerCase();
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(value);
  if (rgb && rgb.slice(1).every(channel => Number(channel) <= 255)) {
    return `#${rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`;
  }
}

export function safeRichFontSize(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d+px$/.test(value)) return;
  const size = Number.parseInt(value, 10);
  return size >= 12 && size <= 40 ? `${size}px` : undefined;
}

export function safeRichLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return value;
  } catch { /* Unsafe or incomplete URLs remain plain text. */ }
}

function cleanMarks(value: unknown): RichMark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((mark): RichMark[] => {
    if (!mark || typeof mark !== 'object') return [];
    if (['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript'].includes(mark.type)) {
      return [{ type: mark.type }];
    }
    if (mark.type === 'link') {
      const href = safeRichLink(mark.attrs?.href);
      return href ? [{ type: 'link', attrs: { href } }] : [];
    }
    if (mark.type === 'textStyle') {
      const color = safeRichColor(mark.attrs?.color);
      const fontSize = safeRichFontSize(mark.attrs?.fontSize);
      const attrs = { ...(color ? { color } : {}), ...(fontSize ? { fontSize } : {}) };
      return Object.keys(attrs).length ? [{ type: 'textStyle', attrs }] : [];
    }
    return [];
  });
}

/** Also used before writing: clipboard CSS, event attributes and unknown nodes never persist. */
export function cleanRichDocument(value: unknown): RichNode {
  let count = 0;
  function clean(input: unknown, depth = 0): RichNode | null {
    if (!input || typeof input !== 'object' || depth > 30 || ++count > 10000) return null;
    const node = input as RichNode;
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text) return null;
      const marks = cleanMarks(node.marks);
      return { type: 'text', text: node.text, ...(marks.length ? { marks } : {}) };
    }
    if (node.type === 'hardBreak') return { type: 'hardBreak' };
    if (!['doc', 'paragraph', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type)) return null;
    const children = Array.isArray(node.content)
      ? node.content.flatMap(child => { const next = clean(child, depth + 1); return next ? [next] : []; })
      : [];
    const content = children.filter(child => node.type === 'paragraph'
      ? ['text', 'hardBreak'].includes(child.type)
      : ['bulletList', 'orderedList'].includes(node.type)
        ? child.type === 'listItem'
        : ['paragraph', 'bulletList', 'orderedList', 'blockquote'].includes(child.type));
    if (node.type === 'listItem' && content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
    const start = node.type === 'orderedList' && Number.isInteger(node.attrs?.start)
      ? Math.min(9999, Math.max(1, Number(node.attrs?.start))) : 1;
    return { type: node.type, ...(start !== 1 ? { attrs: { start } } : {}), ...(content.length ? { content } : {}) };
  }
  const doc = clean(value);
  return doc?.type === 'doc' && doc.content?.length ? doc : { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function parseRichDocument(value: string): RichNode | null {
  if (!value.startsWith(RICH_DOCUMENT_PREFIX) || value.length > 200000) return null;
  try {
    const parsed = JSON.parse(value.slice(RICH_DOCUMENT_PREFIX.length));
    return parsed?.type === 'doc' ? cleanRichDocument(parsed) : null;
  } catch { return null; }
}

// Match the legacy renderer, recursively: existing red + superscript/bold combinations survive.
const legacyTokens = /(https?:\/\/[^\s<]+|\*\*[^*\n]+\*\*|!![^!\n]+!!|_[^_\n]+_|\^[^^\n]+\^|~[^~\n]+~)/g;
function legacyInline(value: string, marks: RichMark[] = []): RichNode[] {
  const nodes: RichNode[] = [];
  const add = (text: string) => { if (text) nodes.push({ type: 'text', text, ...(marks.length ? { marks } : {}) }); };
  let cursor = 0;
  for (const match of value.matchAll(legacyTokens)) {
    const index = match.index ?? 0;
    add(value.slice(cursor, index));
    const token = match[0];
    const type = token.startsWith('http') ? 'link' : token.startsWith('**') ? 'bold'
      : token.startsWith('!!') ? 'textStyle' : token.startsWith('_') ? 'italic'
        : token.startsWith('^') ? 'superscript' : 'subscript';
    const mark: RichMark = type === 'link' ? { type, attrs: { href: token } }
      : type === 'textStyle' ? { type, attrs: { color: 'var(--danger)' } } : { type };
    if (type === 'link') nodes.push({ type: 'text', text: token, marks: [...marks, mark] });
    else {
      const length = ['bold', 'textStyle'].includes(type) ? 2 : 1;
      const nextMarks = [...marks];
      if (!nextMarks.some(existing => existing.type === type)) nextMarks.push(mark);
      // The old red token also used semibold. Import that as an editable bold mark,
      // not CSS tied to red, so red and bold can now be toggled independently.
      if (type === 'textStyle' && !nextMarks.some(existing => existing.type === 'bold')) nextMarks.push({ type: 'bold' });
      nodes.push(...legacyInline(token.slice(length, -length), nextMarks));
    }
    cursor = index + token.length;
  }
  add(value.slice(cursor));
  return nodes;
}

export function toRichDocument(value: string): RichNode {
  return parseRichDocument(value) ?? {
    type: 'doc',
    content: value.split('\n').map(line => ({ type: 'paragraph', content: legacyInline(line) })),
  };
}

export function richDocumentText(node: RichNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(richDocumentText).join(node.type === 'paragraph' ? '' : '\n');
}

export function serializeRichDocument(value: unknown): string {
  const doc = cleanRichDocument(value);
  return richDocumentText(doc).trim() ? RICH_DOCUMENT_PREFIX + JSON.stringify(doc) : '';
}

export function mergeRichTextValues(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  if (!parseRichDocument(left) && !parseRichDocument(right)) return `${left}\n\n${right}`;
  return serializeRichDocument({ type: 'doc', content: [
    ...(toRichDocument(left).content ?? []), { type: 'paragraph' }, ...(toRichDocument(right).content ?? []),
  ] });
}
