export interface TextFormattingResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function toggleBoldFormatting(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextFormattingResult {
  const selected = value.slice(selectionStart, selectionEnd);

  if (selected.startsWith('**') && selected.endsWith('**') && selected.length > 4) {
    const unwrapped = selected.slice(2, -2);
    return {
      value: `${value.slice(0, selectionStart)}${unwrapped}${value.slice(selectionEnd)}`,
      selectionStart,
      selectionEnd: selectionStart + unwrapped.length,
    };
  }

  if (
    selectionStart >= 2 &&
    value.slice(selectionStart - 2, selectionStart) === '**' &&
    value.slice(selectionEnd, selectionEnd + 2) === '**'
  ) {
    return {
      value: `${value.slice(0, selectionStart - 2)}${selected}${value.slice(selectionEnd + 2)}`,
      selectionStart: selectionStart - 2,
      selectionEnd: selectionEnd - 2,
    };
  }

  const content = selected || '粗體文字';
  return {
    value: `${value.slice(0, selectionStart)}**${content}**${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + 2,
    selectionEnd: selectionStart + 2 + content.length,
  };
}
