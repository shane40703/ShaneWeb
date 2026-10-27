import { useEffect, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { QuestionReviewDetails } from './question-review-details';

afterEach(cleanup);
it('starts listeners only on first expansion and preserves an unsaved draft when collapsed', async () => {
  const mounted = vi.fn();
  const unmounted = vi.fn();
  function Content() {
    const [draft, setDraft] = useState('');
    useEffect(() => { mounted(); return unmounted; }, []);
    return <input aria-label="筆記草稿" value={draft} onChange={event => setDraft(event.target.value)} />;
  }
  const user = userEvent.setup();
  render(<QuestionReviewDetails className="test" label="展開題目"><Content /></QuestionReviewDetails>);
  expect(mounted).not.toHaveBeenCalled();
  await user.click(screen.getByText('展開題目'));
  await user.type(await screen.findByRole('textbox'), '尚未儲存');
  await user.click(screen.getByText('展開題目'));
  expect(unmounted).not.toHaveBeenCalled();
  await user.click(screen.getByText('展開題目'));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('尚未儲存'));
  expect(mounted).toHaveBeenCalledOnce();
});
