import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from '@/components/rich-text';

describe('RichText', () => {
  it('renders bold notation and safe external links', () => {
    render(<p><RichText>請看 **重點** https://example.com/rule</RichText></p>);

    expect(screen.getByText('重點').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'https://example.com/rule' })).toHaveAttribute(
      'href',
      'https://example.com/rule',
    );
  });

  it('renders italic, superscript, subscript, and red notation', () => {
    render(<p><RichText>_斜體_ ^上標^ ~下標~ !!紅字!!</RichText></p>);

    expect(screen.getByText('斜體').tagName).toBe('EM');
    expect(screen.getByText('上標').tagName).toBe('SUP');
    expect(screen.getByText('下標').tagName).toBe('SUB');
    expect(screen.getByText('紅字')).toHaveClass(/red/);
  });
});
