import type { ComponentProps, MouseEvent } from 'react';

/**
 * A real link for search engines and new tabs; a plain click stays on the loaded page.
 * Not next/link: that one fetches the page's data on hover, which a click here never uses.
 */
export function InPageLink({
  onFollow,
  ...props
}: ComponentProps<'a'> & { onFollow: () => void }) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onFollow();
  }

  return <a {...props} onClick={click} />;
}
