import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PracticeLayout } from './practice-layout';

afterEach(cleanup);

describe('PracticeLayout', () => {
  it('leads back to the hub above the page, without a section switcher', () => {
    render(
      <PracticeLayout>
        <p>頁面內容</p>
      </PracticeLayout>,
    );

    const back = screen.getByRole('link', { name: '返回每日練習' });
    expect(back).toHaveAttribute('href', '/practice');
    expect(
      back.compareDocumentPosition(screen.getByText('頁面內容')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
