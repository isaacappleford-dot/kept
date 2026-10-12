import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseAmount } from './money';

describe('money', () => {
  it('parses amounts to cents', () => {
    expect(parseAmount('$1,234.56')).toBe(123456);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12,50')).toBe(1250);
    expect(parseAmount('1.234,50')).toBe(123450);
    expect(parseAmount('-4.00')).toBe(-400);
    expect(parseAmount('0.1')).toBe(10);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('formats cents', () => {
    expect(formatMoney(12000, 'USD')).toMatch(/120\.00/);
    expect(formatMoney(12000, 'USD', { whole: true })).toMatch(/\$120$/);
    expect(formatMoney(1999, 'USD', { whole: true })).toMatch(/19\.99/);
    expect(formatMoney(null)).toBe('');
    expect(centsToInput(1999)).toBe('19.99');
  });
});
