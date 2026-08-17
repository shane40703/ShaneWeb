export interface TextFormattingResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type TextFormat = 'bold' | 'italic' | 'superscript' | 'subscript' | 'red';

const formats: Record<TextFormat, { marker: string; placeholder: string }> = {
  bold: { marker: '**', placeholder: '粗體文字' },
  italic: { marker: '_', placeholder: '斜體文字' },
  superscript: { marker: '^', placeholder: '上標文字' },
  subscript: { marker: '~', placeholder: '下標文字' },
  red: { marker: '!!', placeholder: '紅色文字' },
};

export function toggleTextFormatting(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: TextFormat,
): TextFormattingResult {
  const { marker, placeholder } = formats[format];
  const markerLength = marker.length;
  const selected = value.slice(selectionStart, selectionEnd);

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length > markerLength * 2
  ) {
    const unwrapped = selected.slice(markerLength, -markerLength);
    return {
      value: `${value.slice(0, selectionStart)}${unwrapped}${value.slice(selectionEnd)}`,
      selectionStart,
      selectionEnd: selectionStart + unwrapped.length,
    };
  }

  if (
    selectionStart >= markerLength &&
    value.slice(selectionStart - markerLength, selectionStart) === marker &&
    value.slice(selectionEnd, selectionEnd + markerLength) === marker
  ) {
    return {
      value: `${value.slice(0, selectionStart - markerLength)}${selected}${value.slice(selectionEnd + markerLength)}`,
      selectionStart: selectionStart - markerLength,
      selectionEnd: selectionEnd - markerLength,
    };
  }

  const content = selected || placeholder;
  return {
    value: `${value.slice(0, selectionStart)}${marker}${content}${marker}${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + markerLength,
    selectionEnd: selectionStart + markerLength + content.length,
  };
}

export function toggleBoldFormatting(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextFormattingResult {
  return toggleTextFormatting(value, selectionStart, selectionEnd, 'bold');
}
