import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './calculator';
import { ownsEditingKeys } from '@/features/practice/quiz-keyboard';

beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('calculator', () => {
  it('calculates, keeps the expression after closing, and can clear it', () => {
    render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    const input = screen.getByRole('textbox', { name: '計算算式' });
    fireEvent.change(input, { target: { value: '(2.5×3)÷4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('= 1.875')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收合計算機' }));
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    expect(screen.getByRole('textbox', { name: '計算算式' })).toHaveValue('(2.5×3)÷4');
    expect(screen.getByText('= 1.875')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(screen.getByRole('textbox', { name: '計算算式' })).toHaveValue('');
  });
  it('reports invalid expressions and keeps calculator controls out of quiz shortcuts', () => {
    render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    const input = screen.getByRole('textbox', { name: '計算算式' });
    fireEvent.change(input, { target: { value: '2/0' } });
    fireEvent.click(screen.getByRole('button', { name: '計算結果' }));
    expect(screen.getByRole('alert')).toHaveTextContent('除數不能為 0');
    expect(ownsEditingKeys(input)).toBe(true);
    expect(ownsEditingKeys(screen.getByRole('button', { name: '1' }))).toBe(true);
  });
  it('applies square, square root and negative to the current expression', () => {
    render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    const input = screen.getByRole('textbox', { name: '計算算式' });
    fireEvent.change(input, { target: { value: '2+3' } });
    fireEvent.click(screen.getByRole('button', { name: '平方' }));
    fireEvent.click(screen.getByRole('button', { name: '計算結果' }));
    expect(screen.getByText('= 25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '平方根' }));
    fireEvent.click(screen.getByRole('button', { name: '計算結果' }));
    expect(screen.getByText('= 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '正負號' }));
    fireEvent.click(screen.getByRole('button', { name: '計算結果' }));
    expect(screen.getByText('= -5')).toBeInTheDocument();
  });
  it('restores an unfinished expression when the question component remounts', () => {
    const view = render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    fireEvent.change(screen.getByRole('textbox', { name: '計算算式' }), { target: { value: '3+4' } });
    view.unmount();
    render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '開啟計算機' }));
    expect(screen.getByRole('textbox', { name: '計算算式' })).toHaveValue('3+4');
  });
});
