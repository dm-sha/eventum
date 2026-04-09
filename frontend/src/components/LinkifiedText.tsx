import type { FC, ReactNode } from 'react';

/**
 * Рендерит текст с кликабельными ссылками (http/https). Остальной текст и переносы строк сохраняются.
 */
function linkifyToNodes(text: string): ReactNode[] {
  const re = /https?:\/\/[^\s<]+/gi;
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      out.push(text.slice(last, match.index));
    }
    const url = match[0];
    out.push(
      <a
        key={`link-${k++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-800 hover:decoration-blue-800 break-all"
      >
        {url}
      </a>
    );
    last = re.lastIndex;
  }
  if (last < text.length) {
    out.push(text.slice(last));
  }
  return out;
}

type Props = {
  text: string;
  className?: string;
};

const LinkifiedText: FC<Props> = ({ text, className }) => (
  <span className={className}>{linkifyToNodes(text)}</span>
);

export default LinkifiedText;
