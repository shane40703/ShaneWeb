import type { ReactNode } from 'react';

const tokenPattern = /(https?:\/\/[^\s<]+|\*\*[^*\n]+\*\*)/g;

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
    } else {
      parts.push(<strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>);
    }
    cursor = index + token.length;
  }
  if (cursor < children.length) parts.push(children.slice(cursor));

  return <>{parts}</>;
}
