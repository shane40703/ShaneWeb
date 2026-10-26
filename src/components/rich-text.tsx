import type { ReactNode } from 'react';
import { parseRichDocument, type RichNode } from '@/lib/rich-document';
import styles from './rich-text.module.css';

const tokenPattern = /(https?:\/\/[^\s<]+|\*\*[^*\n]+\*\*|!![^!\n]+!!|_[^_\n]+_|\^[^^\n]+\^|~[^~\n]+~)/g;

function renderRichText(children: string) {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of children.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(children.slice(cursor, index));
    const token = match[0];
    if (token.startsWith('http')) {
      parts.push(
        <a key={`${index}-${token}`} href={token} target="_blank" rel="noreferrer">
          {token}
        </a>,
      );
    } else if (token.startsWith('**')) {
      parts.push(
        <strong key={`${index}-${token}`}>
          {renderRichText(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith('!!')) {
      parts.push(
        <span className={styles.red} key={`${index}-${token}`}>
          {renderRichText(token.slice(2, -2))}
        </span>,
      );
    } else if (token.startsWith('_')) {
      parts.push(<em key={`${index}-${token}`}>{renderRichText(token.slice(1, -1))}</em>);
    } else if (token.startsWith('^')) {
      parts.push(<sup key={`${index}-${token}`}>{renderRichText(token.slice(1, -1))}</sup>);
    } else {
      parts.push(<sub key={`${index}-${token}`}>{renderRichText(token.slice(1, -1))}</sub>);
    }
    cursor = index + token.length;
  }
  if (cursor < children.length) parts.push(children.slice(cursor));

  return parts;
}

export function RichText({ children }: { children: string }) {
  const doc = parseRichDocument(children);
  if (doc) return <span className={styles.content}>{renderDocumentNode(doc)}</span>;
  return <span className={styles.content}>{renderRichText(children)}</span>;
}

function renderDocumentNode(node: RichNode, key = 0): ReactNode {
  const children = node.content?.flatMap((child, index) => [
    ...(index && ['doc', 'blockquote', 'listItem'].includes(node.type) ? ['\n'] : []),
    renderDocumentNode(child, index),
  ]);
  if (node.type === 'text') {
    const text = (node.marks ?? []).reduceRight<ReactNode>((content, mark) => {
      if (mark.type === 'bold') return <strong>{content}</strong>;
      if (mark.type === 'italic') return <em>{content}</em>;
      if (mark.type === 'underline') return <u>{content}</u>;
      if (mark.type === 'strike') return <s>{content}</s>;
      if (mark.type === 'superscript') return <sup>{content}</sup>;
      if (mark.type === 'subscript') return <sub>{content}</sub>;
      if (mark.type === 'link') return <a href={mark.attrs?.href} target="_blank" rel="noreferrer">{content}</a>;
      return <span style={{ color: mark.attrs?.color, fontSize: mark.attrs?.fontSize }}>{content}</span>;
    }, node.text);
    return <span key={key}>{text}</span>;
  }
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'paragraph') return <span key={key} className={styles.paragraph}>{children}</span>;
  if (node.type === 'blockquote') return <span key={key} className={styles.quote}>{children}</span>;
  if (node.type === 'listItem') return <span key={key} role="listitem" className={styles.listItem}>{children}</span>;
  if (node.type === 'bulletList' || node.type === 'orderedList') return (
    <span key={key} role="list" className={styles.list} data-ordered={node.type === 'orderedList' || undefined}
      style={{ counterReset: `rich-list ${Number(node.attrs?.start ?? 1) - 1}` }}>{children}</span>
  );
  return children;
}
