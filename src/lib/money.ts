/** Money is stored as integer cents to avoid floating-point drift. */

/** "$1,234.56" → 123456. Accepts "12,50" as a decimal comma. Returns null if there's no number. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return null;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  if (/,\d{2}$/.test(s) && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}

const fmtCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number | null | undefined, currency = 'USD', opts: { whole?: boolean } = {}): string {
  if (cents === null || cents === undefined) return '';
  const whole = opts.whole && cents % 100 === 0;
  const key = `${currency}:${whole}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    } catch {
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f.format(cents / 100);
}

/** Plain "12.34" for form inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}
