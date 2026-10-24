import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { safeHref } from './safe-href';

const INLINE = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [, bold, label, href] = match;
    const id = `${key}-${match.index}`;
    if (bold !== undefined) nodes.push(<strong key={id}>{bold}</strong>);
    else if (label !== undefined && href !== undefined) {
      const safe = safeHref(href);
      nodes.push(
        safe ? (
          <Link key={id} to={safe}>
            {label}
          </Link>
        ) : (
          label
        ),
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const LIST_ITEM = /^\s*(?:[-*•]|\d+\.)\s+/;

/** The assistant's answer: paragraphs, lists, bold and links to KaufCheck – nothing else. */
export function ChatText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim() !== '');
  return (
    <>
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter((line) => line.trim() !== '');
        const key = `b${index}`;
        if (lines.length > 0 && lines.every((line) => LIST_ITEM.test(line))) {
          const ordered = /^\s*\d+\./.test(lines[0] ?? '');
          const items = lines.map((line, i) => (
            <li key={`${key}-${i}`}>{inline(line.replace(LIST_ITEM, ''), `${key}-${i}`)}</li>
          ));
          return ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }
        return (
          <p key={key}>
            {lines.flatMap((line, i) => [
              ...(i > 0 ? [<br key={`${key}-br${i}`} />] : []),
              ...inline(line, `${key}-${i}`),
            ])}
          </p>
        );
      })}
    </>
  );
}
