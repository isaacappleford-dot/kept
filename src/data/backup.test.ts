import { describe, expect, it } from 'vitest';
import { validateBackup } from './backup';

describe('backup validation', () => {
  const ok = { app: 'kept', version: 1, exportedAt: '', cards: [{ id: 'a', kind: 'purchase', date: '2026-10-11' }], savings: [], images: [] };
  it('accepts a good file', () => expect(validateBackup(ok)).toBeNull());
  it('rejects other apps, versions and damage', () => {
    expect(validateBackup(null)).toMatch(/isn’t a backup/);
    expect(validateBackup({ ...ok, app: 'thirds' })).toMatch(/Kept backup/);
    expect(validateBackup({ ...ok, version: 2 })).toMatch(/newer version/);
    expect(validateBackup({ ...ok, cards: [{}] })).toMatch(/damaged/);
    expect(validateBackup({ ...ok, images: [{ id: 'a', image: 'javascript:alert(1)', thumb: '' }] })).toMatch(/damaged/);
  });
});

describe('backup labels', () => {
  const ok = { app: 'kept', version: 1, exportedAt: '', cards: [], savings: [], images: [{ id: 'a', image: 'data:image/jpeg;base64,AA', thumb: 'data:image/jpeg;base64,AA' }] };
  it('accepts an optional label picture and rejects a bad one', () => {
    expect(validateBackup({ ...ok, images: [{ ...ok.images[0], label: 'data:image/jpeg;base64,AA' }] })).toBeNull();
    expect(validateBackup({ ...ok, images: [{ ...ok.images[0], label: 'javascript:alert(1)' }] })).toMatch(/damaged/);
  });
});
