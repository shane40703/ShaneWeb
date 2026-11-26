import { useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconCalculator, IconGripHorizontal, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { calculate } from '@/lib/calculator';
import styles from './calculator.module.css';

const storageKey = 'shaneweb:calculator';
type Calculation = { expression: string; result: string };
type CalculatorKey = { label: string; display?: string; value?: string; action?: 'clear' | 'backspace' | 'square' | 'root' | 'negative' };
const keys: CalculatorKey[] = [
  { label: '清除', action: 'clear' }, { label: '退格', display: '⌫', action: 'backspace' },
  { label: '左括號', display: '(', value: '(' }, { label: '右括號', display: ')', value: ')' },
  { label: '平方', display: 'x²', action: 'square' }, { label: '次方', display: 'xʸ', value: '^' },
  { label: '平方根', display: '√', action: 'root' }, { label: '百分比', display: '%', value: '%' },
  ...['7', '8', '9'].map(value => ({ label: value, value })), { label: '除', display: '÷', value: '÷' },
  ...['4', '5', '6'].map(value => ({ label: value, value })), { label: '乘', display: '×', value: '×' },
  ...['1', '2', '3'].map(value => ({ label: value, value })), { label: '減', display: '−', value: '-' },
  { label: '正負號', display: '±', action: 'negative' }, { label: '0', value: '0' },
  { label: '小數點', display: '.', value: '.' }, { label: '加', display: '+', value: '+' },
];

function savedCalculation(): Calculation {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (typeof saved?.expression === 'string' && typeof saved?.result === 'string') {
      return { expression: saved.expression.slice(0, 160), result: saved.result.slice(0, 40) };
    }
  } catch { /* Storage is optional. */ }
  return { expression: '', result: '' };
}

export function Calculator() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mini = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointer: number; dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [calculation, setCalculation] = useState<Calculation>(() =>
    typeof window === 'undefined' ? { expression: '', result: '' } : savedCalculation(),
  );
  const [error, setError] = useState('');
  const { expression, result } = calculation;

  function focusInput() {
    // The on-screen keypad should not summon a phone's system keyboard.
    if (window.innerWidth > 600) input.current?.focus({ preventScroll: true });
  }

  function update(next: Calculation) {
    setCalculation(next);
    setError('');
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Work in memory. */ }
  }
  function insert(value: string) {
    const field = input.current;
    const start = field?.selectionStart ?? expression.length;
    const end = field?.selectionEnd ?? expression.length;
    const continuing = result && start === expression.length && end === expression.length;
    const base = continuing ? (/^[+\-×÷^%]/.test(value) ? result : '') : expression;
    const from = continuing ? base.length : start;
    const to = continuing ? base.length : end;
    const next = (base.slice(0, from) + value + base.slice(to)).slice(0, 160);
    update({ expression: next, result: '' });
    requestAnimationFrame(() => {
      focusInput();
      const caret = Math.min(from + value.length, next.length);
      field?.setSelectionRange(caret, caret);
    });
  }
  function evaluate() {
    try { update({ expression, result: calculate(expression) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '無法計算'); }
  }
  function wrap(kind: 'square' | 'root' | 'negative') {
    const base = result || expression;
    if (!base) { if (kind === 'root') insert('√('); else if (kind === 'negative') insert('-'); return; }
    const next = kind === 'square' ? `(${base})^2` : kind === 'root' ? `√(${base})` : `-(${base})`;
    update({ expression: next.slice(0, 160), result: '' });
    requestAnimationFrame(focusInput);
  }
  function close() {
    setOpen(false);
    requestAnimationFrame(() => (window.innerWidth <= 600 ? mini.current : trigger.current)?.focus({ preventScroll: true }));
  }
  function show() {
    setHasOpened(true);
    setOpen(true);
    requestAnimationFrame(focusInput);
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || window.innerWidth <= 600 || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    setPosition({
      left: Math.max(0, Math.min(window.innerWidth - rect.width, event.clientX - drag.current.dx)),
      top: Math.max(0, Math.min(window.innerHeight - rect.height, event.clientY - drag.current.dy)),
    });
  }
  function press(key: CalculatorKey) {
    if (key.action === 'clear') return update({ expression: '', result: '' });
    if (key.action === 'backspace') {
      const field = input.current;
      const start = field?.selectionStart ?? expression.length;
      const end = field?.selectionEnd ?? start;
      const from = start === end ? Math.max(0, start - 1) : start;
      update({ expression: expression.slice(0, from) + expression.slice(end), result: '' });
      requestAnimationFrame(() => { focusInput(); field?.setSelectionRange(from, from); });
      return;
    }
    if (key.action) return wrap(key.action);
    insert(key.value ?? '');
  }
  return <div className={styles.root} data-calculator>
    <Button ref={trigger} className={styles.trigger} aria-label="開啟計算機" aria-expanded={open} aria-controls={id}
      onClick={show}>
      <IconCalculator size={17} aria-hidden="true" /><span>計算機</span>
    </Button>
    {!open && hasOpened ? createPortal(<button ref={mini} type="button" className={styles.mini} data-calculator aria-label="重新開啟計算機" onClick={show}><IconCalculator size={17} aria-hidden="true" /> 計算機</button>, document.body) : null}
    {open ? createPortal(<div ref={panel} id={id} role="region" aria-label="計算機" className={styles.panel} data-calculator
      style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : undefined}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        else if (event.key === 'Enter' && event.target === input.current) { event.preventDefault(); evaluate(); }
      }}>
      <div className={styles.header} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <strong><IconGripHorizontal size={17} aria-hidden="true" /> 計算機</strong>
        <button type="button" aria-label="收合計算機" onPointerDown={event => event.stopPropagation()} onClick={close}><IconX size={18} aria-hidden="true" /></button>
      </div>
      <label className={styles.display}>算式
        <input ref={input} value={expression} aria-label="計算算式" placeholder="輸入算式" maxLength={160} autoComplete="off"
          onChange={event => update({ expression: event.target.value, result: '' })} />
      </label>
      <div className={styles.result} aria-live="polite">{error ? <span role="alert">{error}</span> : result ? <span>= {result}</span> : <span>輸入算式後按 =</span>}</div>
      <div className={styles.keys}>
        {keys.map(key => <button type="button" key={key.label} aria-label={key.label} onMouseDown={event => event.preventDefault()}
          onClick={() => press(key)}>{key.display ?? key.label}</button>)}
        <button type="button" className={styles.equals} aria-label="計算結果" onMouseDown={event => event.preventDefault()} onClick={evaluate}>=</button>
      </div>
    </div>, document.body) : null}
  </div>;
}
