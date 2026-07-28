import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LawDatabasePage } from '@/features/laws/law-database-page';

describe('LawDatabasePage', () => {
  it('links every law to the national laws and regulations database search', () => {
    render(<LawDatabasePage laws={[{ name: '建築法', questionCount: 12 }]} />);

    const link = screen.getByRole('link', { name: /建築法/ });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('law.moj.gov.tw/Law/LawSearchResult.aspx'),
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('出現在 12 題考題分類')).toBeInTheDocument();
  });
});
