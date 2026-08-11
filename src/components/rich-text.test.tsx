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
});
