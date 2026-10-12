import { describe, expect, it } from 'vitest';
import { emptyDraft, type Card } from '../data/types';
import { deadlines } from '../deadlines/deadlines';
import { inventoryCSV, csvCell } from './csv';
import { alarmsFor, buildICS, escapeText, foldLine } from './ics';
import { buildPdf, pdfString, wrapText } from './pdfWriter';

const today = '2026-10-11';
const card = (p: Partial<Card>): Card => ({ ...emptyDraft(today), id: 'abc', createdAt: 0, updatedAt: 0, ...p });

describe('ics', () => {
  it('escapes and folds per RFC 5545', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const long = `SUMMARY:${'x'.repeat(200)}`;
    const folded = foldLine(long);
    expect(folded.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('writes all-day events with alarms', () => {
    const list = deadlines([card({ store: 'Target', title: 'Boots', total: 12000, returnBy: '2026-10-20' })], today);
    const ics = buildICS(list, today, new Date('2026-10-11T12:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('DTEND;VALUE=DATE:20261021');
    expect(ics).toContain('SUMMARY:Return by: Boots');
    expect(ics).toContain('UID:abc-return@kept.app');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('only adds alarms that are still in the future', () => {
    expect(alarmsFor('return', 2)).toEqual(['-P0DT15H', 'PT9H']);
    expect(alarmsFor('warranty', 60)).toEqual(['-P29DT15H', '-P6DT15H']);
  });
});

describe('csv', () => {
  it('quotes and defuses formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe('');
  });

  it('lists owned purchases', () => {
    const csv = inventoryCSV([
      card({ title: 'TV', store: 'Best Buy', total: 49999, serial: 'SN1', category: 'tv' }),
      card({ title: 'Returned lamp', returnStatus: 'returned' }),
      card({ kind: 'coupon', title: 'Coupon' }),
    ]);
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('TV,Best Buy,2026-10-11,499.99,TV,SN1');
  });
});

describe('pdf writer', () => {
  it('escapes strings and maps to WinAnsi', () => {
    expect(pdfString('a(b)c\\')).toBe('(a\\(b\\)c\\\\)');
    expect(pdfString('café')).toBe('(caf\\351)');
    expect(pdfString('’')).toBe('(\\222)');
    expect(pdfString('日本')).toBe('(??)');
  });

  it('wraps text', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 12, 80);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('writes a structurally valid PDF with a correct xref table', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const bytes = buildPdf([{ ops: [{ t: 'text', x: 40, y: 40, size: 12, text: 'Hello' }, { t: 'image', x: 40, y: 60, w: 100, h: 100, jpeg, pxW: 1, pxH: 1 }] }, { ops: [] }]);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    entries.forEach((off, i) => expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});
