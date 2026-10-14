import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RichText } from '@/components/rich-text';
afterEach(cleanup);

describe('RichText', () => {
  it('preserves notes whitespace, blank lines and tabs without parsing arbitrary HTML', () => {
    const content = '  第一行  對齊\n\n\t第二行 **重點**\n<script>alert(1)</script>';
    const { container } = render(<p><RichText>{content}</RichText></p>);
    const text = container.querySelector('p > span')!;
    expect(text).toHaveClass(/content/);
    expect(text.textContent).toBe(content.replace('**重點**', '重點'));
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('重點').tagName).toBe('STRONG');
  });
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

  it('renders nested red and superscript formatting together', () => {
    render(<p><RichText>!!0.75m^2^!! 與 ^!!3!!^</RichText></p>);

    const firstSuperscript = screen.getByText('2');
    expect(firstSuperscript.tagName).toBe('SUP');
    expect(firstSuperscript.closest('span')).toHaveClass(/red/);

    const redInsideSuperscript = screen.getByText('3');
    expect(redInsideSuperscript).toHaveClass(/red/);
    expect(redInsideSuperscript.closest('sup')).toBeInTheDocument();
  });
});
