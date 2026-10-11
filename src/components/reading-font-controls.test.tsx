import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingFontControls } from './reading-font-controls';

const dispatch = vi.hoisted(() => vi.fn());
vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: { readingPreferences: { questionFontSize: 22, optionFontSize: 16 } },
    dispatch,
  }),
}));

beforeEach(() => dispatch.mockReset());
afterEach(cleanup);

describe('ReadingFontControls', () => {
  it('reflects existing preferences with the supported range and independent targets', () => {
    render(<ReadingFontControls />);
    const question = screen.getByRole('slider', { name: '題目字體' });
    const option = screen.getByRole('slider', { name: '選項字體' });
    expect(question).toHaveValue('22');
    expect(option).toHaveValue('16');
    for (const slider of [question, option]) {
      expect(slider).toHaveAttribute('min', '14');
      expect(slider).toHaveAttribute('max', '24');
      expect(slider).toHaveAttribute('step', '2');
    }
    fireEvent.change(question, { target: { value: '24' } });
    fireEvent.change(option, { target: { value: '14' } });
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'set-reading-font-size', target: 'question', size: 24 }],
      [{ type: 'set-reading-font-size', target: 'option', size: 14 }],
    ]);
  });

  it('keeps datalist IDs unique when multiple settings panels are rendered', () => {
    render(<><ReadingFontControls /><ReadingFontControls /></>);
    const ids = screen.getAllByRole('slider').map((slider) => slider.getAttribute('list'));
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(document.getElementById(id!)?.querySelectorAll('option')).toHaveLength(6);
    }
  });
});
