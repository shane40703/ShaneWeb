import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LawDatabasePage } from '@/features/laws/law-database-page';

afterEach(cleanup);

describe('LawDatabasePage', () => {
  it('links every law to the national laws and regulations database search', () => {
    render(
      <LawDatabasePage laws={[{ name: '建築法', questionCount: 12, linkable: true }]} />,
    );

    const link = screen.getByRole('link', { name: /建築法/ });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('law.moj.gov.tw/Law/LawSearchResult.aspx'),
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('出現在 12 題考題分類')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('can leave its hero to the resources hub while keeping the region name', () => {
    render(
      <LawDatabasePage
        laws={[{ name: '建築法', questionCount: 12, linkable: true }]}
        showHeader={false}
      />,
    );

    expect(screen.getByRole('region', { name: '法規資料庫' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '法規資料庫' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /建築法/ })).toBeInTheDocument();
  });

  it('does not link unknown or repealed classifications', () => {
    render(
      <LawDatabasePage
        laws={[
          { name: '???', questionCount: 2, linkable: false },
          { name: '廢止', questionCount: 1, linkable: false },
        ]}
      />,
    );

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByText('無法規連結')).toHaveLength(2);
  });

  it('numbers the rows for the eye only, keeping link names as the law names', () => {
    render(
      <LawDatabasePage
        laws={[
          { name: '建築法', questionCount: 3, linkable: true },
          { name: '建築師法', questionCount: 1, linkable: true },
        ]}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^建築法/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^建築師法/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^[12] / })).not.toBeInTheDocument();
  });

  it('shows an empty state in the panel when no law has been tagged yet', () => {
    render(<LawDatabasePage laws={[]} showHeader={false} />);

    expect(screen.getByRole('heading', { name: '尚無法規資料' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('法規')).not.toBeInTheDocument();
  });
});
