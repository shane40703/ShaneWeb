import { describe, expect, it } from 'vitest';
import {
  RICH_DOCUMENT_PREFIX, cleanRichDocument, mergeRichTextValues, parseRichDocument,
  richDocumentText, safeRichColor, serializeRichDocument, toRichDocument,
} from './rich-document';
import { stripTextFormatting } from './text-formatting';

describe('stored rich documents', () => {
  it('imports nested legacy formats, links, whitespace and blank lines without HTML parsing', () => {
    const doc = toRichDocument('  **法條**\n\n\t!!0.75m^2^!! _斜體_ ~3~ https://example.com/a_b\n<script>alert(1)</script>\n');
    expect(richDocumentText(doc)).toBe('  法條\n\n\t0.75m2 斜體 3 https://example.com/a_b\n<script>alert(1)</script>\n');
    const text = doc.content?.[2].content?.find(node => node.text === '2');
    expect(text?.marks).toEqual([
      { type: 'textStyle', attrs: { color: 'var(--danger)' } }, { type: 'bold' }, { type: 'superscript' },
    ]);
    expect(parseRichDocument(serializeRichDocument(doc))).toEqual(cleanRichDocument(doc));
  });

  it('round-trips colours, font sizes, lists and all supported marks in a string', () => {
    const doc = { type: 'doc', content: [{ type: 'orderedList', attrs: { start: 3 }, content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '重點', marks: [
        { type: 'bold' }, { type: 'italic' }, { type: 'underline' }, { type: 'strike' },
        { type: 'textStyle', attrs: { color: '#123abc', fontSize: '24px' } },
      ] }] }] },
    ] }] };
    const saved = serializeRichDocument(doc);
    expect(saved.startsWith(RICH_DOCUMENT_PREFIX)).toBe(true);
    expect(parseRichDocument(saved)).toEqual(doc);
    expect(stripTextFormatting(saved)).toBe('重點');
  });

  it('drops scripts, unsafe links, unknown attributes and CSS before storage or display', () => {
    const raw = { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }, { type: 'paragraph', content: [
      { type: 'text', text: '<img src=x onerror=alert(1)>', marks: [
        { type: 'link', attrs: { href: 'javascript:alert(1)' } },
        { type: 'textStyle', attrs: { color: 'url(evil)', fontSize: '9999px', onmouseover: 'alert(1)' } },
      ] },
    ] }] };
    const saved = serializeRichDocument(raw);
    expect(parseRichDocument(saved)).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: '<img src=x onerror=alert(1)>' },
    ] }] });
    expect(parseRichDocument(RICH_DOCUMENT_PREFIX + '{broken')).toBeNull();
    expect(safeRichColor('rgb(18, 52, 255)')).toBe('#1234ff');
    expect(safeRichColor('var(--arbitrary)')).toBeUndefined();
  });

  it('serializes cleared content as an actual empty string, not a ghost note', () => {
    expect(serializeRichDocument(toRichDocument(' \n\n\t'))).toBe('');
    expect(serializeRichDocument({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });

  it('merges old and new notes structurally without showing serialized code', () => {
    const formatted = serializeRichDocument(toRichDocument('**新筆記**'));
    const merged = mergeRichTextValues('舊筆記', formatted);
    expect(stripTextFormatting(merged)).toBe('舊筆記\n\n新筆記');
    expect(parseRichDocument(merged)?.content?.[2].content?.[0].marks).toEqual([{ type: 'bold' }]);
    expect(mergeRichTextValues('舊', '新')).toBe('舊\n\n新');
  });
});
