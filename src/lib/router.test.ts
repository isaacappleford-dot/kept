import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash, type Route } from './router';

describe('router', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'scan' },
      { name: 'review' },
      { name: 'card', id: 'a b/c' },
      { name: 'edit', id: '123' },
      { name: 'wallet' },
      { name: 'receipts' },
      { name: 'savings' },
      { name: 'settings' },
      { name: 'privacy' },
      { name: 'credits' },
    ];
    for (const r of routes) expect(parseRoute(routeToHash(r))).toEqual(r);
  });

  it('falls back to home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/card')).toEqual({ name: 'home' });
  });
});
