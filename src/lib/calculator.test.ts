import { describe, expect, it } from 'vitest';
import { calculate } from './calculator';

describe('calculator expressions', () => {
  it.each([
    ['(2.5×3)÷4', '1.875'], ['0.1+0.2', '0.3'], ['2+3×4', '14'],
    ['2^3^2', '512'], ['-2^2', '-4'], ['(-2)^2', '4'], ['√(81)', '9'],
    ['200×10%', '20'], ['2.5e-7×2', '5e-7'], ['1/3', '0.333333333333'],
  ])('evaluates %s', (expression, result) => expect(calculate(expression)).toBe(result));
  it.each(['', '1/0', '√(-1)', '(1+2', '2+)', '1+alert(1)', '9'.repeat(161)])('rejects invalid input %s', expression => {
    expect(() => calculate(expression)).toThrow();
  });
});
