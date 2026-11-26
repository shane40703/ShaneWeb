/** Evaluate a bounded arithmetic expression without executing arbitrary code. */
export function calculate(expression: string): string {
  const input = expression.replace(/\s/g, '').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
  if (!input || input.length > 160) throw new Error('請輸入有效的算式');
  let index = 0;
  const peek = () => input[index];
  const take = (char: string) => {
    if (peek() !== char) return false;
    index += 1;
    return true;
  };
  const finite = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('無法計算，請檢查算式');
    return value;
  };
  function primary(): number {
    if (take('(')) {
      const value = sum();
      if (!take(')')) throw new Error('括號尚未配對');
      return value;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(index));
    if (!number) throw new Error('請檢查算式');
    index += number[0].length;
    return finite(Number(number[0]));
  }
  function postfix(): number {
    let value = primary();
    while (take('%')) value /= 100;
    return value;
  }
  function power(): number {
    const base = postfix();
    return take('^') ? finite(base ** unary()) : base;
  }
  function unary(): number {
    if (take('+')) return unary();
    if (take('-')) return -unary();
    if (take('√')) {
      const value = unary();
      if (value < 0) throw new Error('負數無法開平方根');
      return Math.sqrt(value);
    }
    return power();
  }
  function product(): number {
    let value = unary();
    while (peek() === '*' || peek() === '/') {
      const operator = input[index++];
      const right = unary();
      if (operator === '/' && right === 0) throw new Error('除數不能為 0');
      value = finite(operator === '*' ? value * right : value / right);
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = input[index++];
      const right = product();
      value = finite(operator === '+' ? value + right : value - right);
    }
    return value;
  }
  const result = sum();
  if (index !== input.length) throw new Error('請檢查算式');
  return String(Number(finite(result).toPrecision(12)));
}
