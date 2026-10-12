import { useSyncExternalStore } from 'react';

/**
 * Hash routes: works on GitHub Pages without rewrites and gives Android's
 * back button something sensible to do.
 */
export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'review' }
  | { name: 'card'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'wallet' }
  | { name: 'receipts' }
  | { name: 'savings' }
  | { name: 'checkin' }
  | { name: 'store'; store: string }
  | { name: 'settings' }
  | { name: 'privacy' }
  | { name: 'credits' };

const SIMPLE = ['scan', 'review', 'wallet', 'receipts', 'savings', 'checkin', 'settings', 'privacy', 'credits'] as const;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = parts[0];
  if (name === 'card' || name === 'edit') return parts[1] ? { name, id: decodeURIComponent(parts[1]) } : { name: 'home' };
  if (name === 'store') return parts[1] ? { name, store: decodeURIComponent(parts[1]) } : { name: 'wallet' };
  if ((SIMPLE as readonly string[]).includes(name)) return { name: name as (typeof SIMPLE)[number] };
  return { name: 'home' };
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'card':
    case 'edit':
      return `#/${r.name}/${encodeURIComponent(r.id)}`;
    case 'store':
      return `#/store/${encodeURIComponent(r.store)}`;
    case 'home':
      return '#/';
    default:
      return `#/${r.name}`;
  }
}

/** How many entries we pushed ourselves, so "back" never leaves the app. */
let depth = 0;

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const hash = routeToHash(r);
  if (opts.replace) {
    history.replaceState({ depth }, '', hash);
  } else {
    depth += 1;
    history.pushState({ depth }, '', hash);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Go back if we navigated here in-app, otherwise to a sensible parent. */
export function back(fallback: Route = { name: 'home' }) {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  });
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn);
  window.addEventListener('popstate', fn);
  return () => {
    window.removeEventListener('hashchange', fn);
    window.removeEventListener('popstate', fn);
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '');
  return parseRoute(hash);
}
