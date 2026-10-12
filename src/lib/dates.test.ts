import { describe, expect, it } from 'vitest';
import { addDays, addMonths, countdown, daysBetween, fromParts, isISODate, lastWeekday, nextWeekday, relativeDay, todayISO, weekday } from './dates';

describe('dates', () => {
  it('validates real calendar days', () => {
    expect(fromParts(2026, 2, 29)).toBeNull();
    expect(fromParts(2028, 2, 29)).toBe('2028-02-29');
    expect(fromParts(2026, 13, 1)).toBeNull();
    expect(isISODate('2026-10-11')).toBe(true);
    expect(isISODate('2026-10-32')).toBe(false);
    expect(isISODate('10/11/2026')).toBe(false);
  });

  it('adds days across months, years and DST', () => {
    expect(addDays('2026-10-11', 90)).toBe('2027-01-09');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('adds months, clamping the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-11', 12)).toBe('2027-10-11');
    expect(addMonths('2026-10-11', 24)).toBe('2028-10-11');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('counts days between', () => {
    expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
    expect(daysBetween('2026-10-14', '2026-10-11')).toBe(-3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('finds weekdays', () => {
    expect(weekday('2026-10-11')).toBe(0); // Sunday
    expect(nextWeekday('2026-10-11', 5)).toBe('2026-10-16');
    expect(nextWeekday('2026-10-16', 5)).toBe('2026-10-23');
    expect(nextWeekday('2026-10-16', 5, true)).toBe('2026-10-16');
    expect(lastWeekday('2026-10-11', 5)).toBe('2026-10-09');
  });

  it('formats today in local time', () => {
    expect(todayISO(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-11');
    expect(todayISO(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('describes relative days and countdowns', () => {
    expect(relativeDay('2026-10-11', '2026-10-11')).toBe('today');
    expect(relativeDay('2026-10-12', '2026-10-11')).toBe('tomorrow');
    expect(relativeDay('2026-10-16', '2026-10-11')).toBe('Friday');
    expect(relativeDay('2026-10-30', '2026-10-11')).toBe('in 19 days');
    expect(relativeDay('2026-10-08', '2026-10-11')).toBe('3 days ago');
    expect(countdown(0)).toBe('Last day');
    expect(countdown(1)).toBe('1 day left');
    expect(countdown(5)).toBe('5 days left');
    expect(countdown(365)).toBe('12 months left');
    expect(countdown(-2)).toBe('Ended 2 days ago');
  });
});
