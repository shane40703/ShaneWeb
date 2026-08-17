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
      parts.push(<strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('!!')) {
      parts.push(<span className={styles.red} key={`${index}-${token}`}>{token.slice(2, -2)}</span>);
    } else if (token.startsWith('_')) {
      parts.push(<em key={`${index}-${token}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('^')) {
      parts.push(<sup key={`${index}-${token}`}>{token.slice(1, -1)}</sup>);
    } else {
      parts.push(<sub key={`${index}-${token}`}>{token.slice(1, -1)}</sub>);
    }
    cursor = index + token.length;
  }
  if (cursor < children.length) parts.push(children.slice(cursor));

  return <>{parts}</>;
}
