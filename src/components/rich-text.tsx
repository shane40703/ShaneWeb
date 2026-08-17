import type { ReactNode } from 'react';
import styles from './rich-text.module.css';

const tokenPattern = /(https?:\/\/[^\s<]+|\*\*[^*\n]+\*\*|!![^!\n]+!!|_[^_\n]+_|\^[^^\n]+\^|~[^~\n]+~)/g;

export function RichText({ children }: { children: string }) {
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
          <RichText>{token.slice(2, -2)}</RichText>
        </strong>,
      );
    } else if (token.startsWith('!!')) {
      parts.push(
        <span className={styles.red} key={`${index}-${token}`}>
          <RichText>{token.slice(2, -2)}</RichText>
        </span>,
      );
    } else if (token.startsWith('_')) {
      parts.push(<em key={`${index}-${token}`}><RichText>{token.slice(1, -1)}</RichText></em>);
    } else if (token.startsWith('^')) {
      parts.push(<sup key={`${index}-${token}`}><RichText>{token.slice(1, -1)}</RichText></sup>);
    } else {
      parts.push(<sub key={`${index}-${token}`}><RichText>{token.slice(1, -1)}</RichText></sub>);
    }
    cursor = index + token.length;
  }
  if (cursor < children.length) parts.push(children.slice(cursor));

  return <>{parts}</>;
}
