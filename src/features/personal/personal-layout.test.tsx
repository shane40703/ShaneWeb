import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PersonalLayout } from './personal-layout';

afterEach(cleanup);

describe('PersonalLayout', () => {
  it('leads back to the hub above the page', () => {
    render(
      <PersonalLayout>
        <p>頁面內容</p>
      </PersonalLayout>,
    );

    const back = screen.getByRole('link', { name: '返回我的作答存摺' });
    expect(back).toHaveAttribute('href', '/personal');
    expect(
      back.compareDocumentPosition(screen.getByText('頁面內容')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
