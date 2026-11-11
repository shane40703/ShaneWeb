import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOZE_STORAGE_KEY, clozeBank, createClozeSession, parseClozeSession } from './cloze';
import { examsQuestionHref } from '@/lib/question-path';
import { LawClozePage } from './law-cloze-page';

vi.mock('@/state/app-state', () => ({ useAppState: () => ({ reportPersistence: vi.fn() }) }));
const analytics = vi.hoisted(() => ({ trackPractice: vi.fn() }));
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics')>()),
  trackPractice: analytics.trackPractice,
}));
beforeEach(() => {
  analytics.trackPractice.mockClear();
  window.localStorage.clear();
  const session = createClozeSession();
  session.order = ['daylight', ...session.order.filter((id) => id !== 'daylight')].slice(0, session.count);
  window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(session));
});
afterEach(cleanup);

async function renderStarted() {
  const view = render(<LawClozePage />);
  fireEvent.click(await screen.findByRole('button', { name: '繼續上次測驗' }));
  return view;
}

describe('LawClozePage', () => {
  it('does not draw or save a question until the user starts with their chosen settings', async () => {
    localStorage.removeItem(CLOZE_STORAGE_KEY);
    render(<LawClozePage />);
    const start = await screen.findByRole('button', { name: '開始測驗' });
    expect(screen.queryByLabelText('填空完整條文')).not.toBeInTheDocument();
    expect(localStorage.getItem(CLOZE_STORAGE_KEY)).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: '法規' }), { target: { value: 'accessibility' } });
    fireEvent.change(screen.getByRole('combobox', { name: '考點' }), { target: { value: '無障礙客房' } });
    expect(screen.queryByLabelText('填空完整條文')).not.toBeInTheDocument();
    fireEvent.click(start);
    expect(screen.getByRole('heading', { name: '客房衛浴與房內通路' })).toBeInTheDocument();
    await waitFor(() => expect(parseClozeSession(localStorage.getItem(CLOZE_STORAGE_KEY))?.order).toEqual(['a-room']));
  });

  it('offers explicit resume without changing a saved draft, and protects it when starting over', async () => {
    const saved = parseClozeSession(localStorage.getItem(CLOZE_STORAGE_KEY))!;
    saved.answers = clozeBank.questions.find(question => question.id === saved.order[saved.index])!.blanks.map((_, index) => index === 0 ? '草稿' : '');
    localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(saved));
    const original = localStorage.getItem(CLOZE_STORAGE_KEY);
    render(<LawClozePage />);
    await screen.findByRole('button', { name: '繼續上次測驗' });
    expect(screen.queryByLabelText('填空完整條文')).not.toBeInTheDocument();
    expect(localStorage.getItem(CLOZE_STORAGE_KEY)).toBe(original);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '開始新測驗' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(localStorage.getItem(CLOZE_STORAGE_KEY)).toBe(original);
    expect(screen.queryByLabelText('填空完整條文')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '繼續上次測驗' }));
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('草稿');
    fireEvent.click(screen.getByRole('button', { name: '開始新測驗' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(parseClozeSession(localStorage.getItem(CLOZE_STORAGE_KEY))?.answers).toEqual([]));
    confirm.mockRestore();
  });
  it('shows every paragraph and clause before answering, not just the isolated cloze item', async () => {
    const session = createClozeSession({ count: 5 });
    session.order = ['ar-suspension', ...session.order.filter((id) => id !== 'ar-suspension')].slice(0, 5);
    window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(session));
    await renderStarted();
    const passage = await screen.findByLabelText('填空完整條文');
    expect(passage).toHaveTextContent('建築師之懲戒處分如下');
    expect(passage).toHaveTextContent('一、警告');
    expect(passage).toHaveTextContent('二、申誡');
    expect(passage).toHaveTextContent('四、撤銷或廢止開業證書');
    expect(passage).toHaveTextContent('建築師受申誡處分三次以上者');
    expect(passage.querySelectorAll('input')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
    expect(screen.queryByText('完整條文・第 45 條')).not.toBeInTheDocument();
  });
  it('can show answers with incomplete drafts, restores ungraded reading, and resumes normal grading on the next question', async () => {
    const view = await renderStarted();
    const inputs = await screen.findAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: '0.125' } });
    fireEvent.click(screen.getByRole('button', { name: '直接看答案' }));
    expect(screen.getByRole('status')).toHaveTextContent('本題不計分');
    expect(screen.queryByRole('button', { name: '提交答案' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '逐空比對結果' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('第 2 空答案：八分之一')).toHaveTextContent('八分之一');
    await waitFor(() => expect(parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))?.revealed).toEqual(['daylight']));
    const reading = parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))!;
    expect(reading.answers[1]).toBe('0.125');
    expect(reading.results).toEqual({});
    view.unmount();
    await renderStarted();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本題不計分'));
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(screen.queryByText('完整條文・第 41 條')).not.toBeInTheDocument();
    const next = clozeBank.questions.find((q) => q.id === reading.order[1])!;
    next.blanks.forEach((blank, i) => fireEvent.change(screen.getAllByRole('textbox', { name: `第 ${i + 1} 空：${blank.label}` })[0], { target: { value: blank.answer } }));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByRole('status')).toHaveTextContent(`本題答對 ${next.blanks.length} / ${next.blanks.length}`);
    await waitFor(() => expect(Object.keys(parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))!.results)).toEqual([next.id]));
  });

  it('completes an answer-only round without a fabricated success rate', async () => {
    const session = createClozeSession({ lawId: 'accessibility', category: '無障礙客房', count: 5 });
    window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(session));
    await renderStarted();
    fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
    expect(screen.getByRole('heading', { name: '本輪測驗完成' })).toBeInTheDocument();
    expect(screen.getByText(/本輪未提交作答/)).toHaveTextContent('不計答對率');
    expect(document.body.textContent).not.toContain('NaN');
    fireEvent.click(screen.getByRole('button', { name: '再練一輪' }));
    expect(screen.queryByRole('heading', { name: '本輪測驗完成' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '直接看答案' })).toBeEnabled();
  });
  it('grades multiple blanks and reveals the entire article only after submission', async () => {
    const view = await renderStarted();
    const inputs = await screen.findAllByRole('textbox');
    expect(inputs).toHaveLength(3);
    expect(inputs.every((input) => input.closest('[aria-label="填空完整條文"]'))).toBe(true);
    expect(screen.queryByText('完整條文・第 41 條')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
    ['1/5', '0.125', '75'].forEach((value, i) => fireEvent.change(inputs[i], { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByRole('status')).toHaveTextContent('本題答對 2 / 3 空');
    expect(screen.getByText('完整條文・第 41 條')).toBeInTheDocument();
    expect(screen.getByText(/正確：1\/8/)).toBeInTheDocument();
    const article = clozeBank.questions.find((q) => q.id === 'daylight')!.fullText;
    expect(document.querySelector('pre')?.textContent).toBe(article);
    expect([...document.querySelectorAll('pre strong')].map((element) => element.textContent)).toEqual(['五分之一', '八分之一', '七十五']);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(CLOZE_STORAGE_KEY)!).submitted).toBe(true));
    view.unmount();
    await renderStarted();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 / 3'));
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(screen.getAllByRole('textbox').every((element) => !(element as HTMLInputElement).value)).toBe(true);
    expect(screen.queryByText('完整條文・第 41 條')).not.toBeInTheDocument();
  });

  it('opens related past questions in 歷屆試題（討論版）', async () => {
    const evidence = clozeBank.questions.find((q) => q.id === 'daylight')!.evidence[0];
    const name = `${evidence.year} 年・第 ${evidence.number} 題`;
    await renderStarted();
    fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
    expect(screen.getByRole('link', { name, hidden: true })).toHaveAttribute('href', examsQuestionHref(evidence.id));
  });

  describe('usage statistics', () => {
    const start = ['practice_start', 'law_cloze', 'law'];
    const answered = ['question_answered', 'law_cloze', 'law'];
    const revealed = ['answer_revealed', 'law_cloze', 'law'];
    const complete = ['practice_complete', 'law_cloze', 'law'];

    function fillIn(id: string) {
      clozeBank.questions.find((q) => q.id === id)!.blanks.forEach((blank, index) => fireEvent.change(screen.getAllByRole('textbox', { name: `第 ${index + 1} 空：${blank.label}` })[0], { target: { value: blank.answer } }));
    }

    it('starts the round at its first submission, and sends nothing for opening or typing', async () => {
      await renderStarted();
      await screen.findAllByRole('textbox');
      const form = screen.getByRole('button', { name: '提交答案' }).closest('form')!;
      fireEvent.submit(form);
      fillIn('daylight');
      expect(analytics.trackPractice).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, answered]);
    });

    it('starts the round at its first reveal, and later questions only count as answers', async () => {
      await renderStarted();
      fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, revealed]);
      fireEvent.click(screen.getByRole('button', { name: '下一題' }));
      fireEvent.click(screen.getByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, revealed, revealed]);
    });

    it('does not restart a round that was reloaded halfway', async () => {
      const session = parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))!;
      window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify({ ...session, index: 1, results: { daylight: ['1/5', '1/8', '75'] } }));
      await renderStarted();
      fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([revealed]);
    });

    it('completes a longer round on its last question, without starting it again', async () => {
      const session = createClozeSession({ count: 5 });
      window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify({ ...session, index: 4, revealed: session.order.slice(0, 4) }));
      await renderStarted();
      fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([revealed, complete]);
    });

    it('completes a one-question round in order when it is submitted', async () => {
      window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(createClozeSession({ lawId: 'accessibility', category: '無障礙客房', count: 5 })));
      await renderStarted();
      await screen.findAllByRole('textbox');
      fillIn('a-room');
      fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, answered, complete]);
    });

    it('completes a one-question round in order when it is revealed', async () => {
      window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(createClozeSession({ lawId: 'accessibility', category: '無障礙客房', count: 5 })));
      await renderStarted();
      fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, revealed, complete]);
    });

    it('starts a new round after 再練一輪, not from opening it', async () => {
      window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(createClozeSession({ lawId: 'accessibility', category: '無障礙客房', count: 5 })));
      await renderStarted();
      fireEvent.click(await screen.findByRole('button', { name: '直接看答案' }));
      analytics.trackPractice.mockClear();
      fireEvent.click(screen.getByRole('button', { name: '再練一輪' }));
      expect(analytics.trackPractice).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '直接看答案' }));
      expect(analytics.trackPractice.mock.calls).toEqual([start, revealed, complete]);
    });
  });

  it('applies settings only on start and completes a short pool with a summary', async () => {
    await renderStarted();
    await screen.findAllByRole('textbox');
    fireEvent.change(screen.getByRole('combobox', { name: '法規' }), { target: { value: 'accessibility' } });
    fireEvent.change(screen.getByRole('combobox', { name: '考點' }), { target: { value: '無障礙客房' } });
    fireEvent.change(screen.getByRole('combobox', { name: '每次測驗題數' }), { target: { value: '30' } });
    expect(screen.getByRole('heading', { name: '居室採光面積' })).toBeInTheDocument();
    expect(screen.getByText(/此考點題數不足/)).toHaveTextContent('新測驗將抽 1 題');
    fireEvent.click(screen.getByRole('button', { name: '開始新測驗' }));
    const q = clozeBank.questions.find((q) => q.id === 'a-room')!;
    q.blanks.forEach((blank, index) => fireEvent.change(screen.getAllByRole('textbox', { name: `第 ${index + 1} 空：${blank.label}` })[0], { target: { value: blank.answer } }));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByRole('heading', { name: '本輪測驗完成' })).toBeInTheDocument();
    expect(screen.getByText(/1 題中 1 題全對/)).toHaveTextContent('100%');
    expect(screen.getByRole('link', { name: '核對官方原文與附圖 ↗' })).toHaveAttribute('href', q.sourceUrl);
    await waitFor(() => expect(parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))?.order).toEqual(['a-room']));
    fireEvent.click(screen.getByRole('button', { name: '再練一輪' }));
    expect(screen.queryByRole('heading', { name: '本輪測驗完成' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox').every((element) => !(element as HTMLInputElement).value)).toBe(true);
  });
});
