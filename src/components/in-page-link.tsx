import type { ComponentProps, MouseEvent } from 'react';

/** A click the page may follow itself: the main button, with no key that asks for a new tab. */
export function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  );
}

/**
 * A real link for search engines and new tabs; a plain click stays on the loaded page.
 * Not next/link: that one fetches the page's data on hover, which a click here never uses.
 */
export function InPageLink({
  onFollow,
  ...props
}: ComponentProps<'a'> & { onFollow: () => void }) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onFollow();
  }

  return <a {...props} onClick={click} />;
}
