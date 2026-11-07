/** Arrow selection stops at the ends and skips eliminated options. */
export function stepOption(count: number, eliminated: readonly number[], from: number | undefined, step: 1 | -1) {
  let next = from === undefined ? (step > 0 ? 0 : count - 1) : from + step;
  for (; next >= 0 && next < count; next += step) {
    if (!eliminated.includes(next)) return next;
  }
  return undefined;
}

export function ownsEditingKeys(target: HTMLElement) {
  return Boolean(target.closest('[role="dialog"], [role="alertdialog"], input, textarea, select, [contenteditable="true"], [role="textbox"]')) || target.isContentEditable;
}

/** Buttons/links keep native Space activation; radio Space is our elimination shortcut. */
export function ownsSpaceKey(target: HTMLElement) {
  return !target.closest('[role="radio"]') && Boolean(target.closest('button, a, [role="button"], summary'));
}

export function isSubmitShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}
