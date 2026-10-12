import { APP } from '../config/app';

/** localStorage that never throws (private mode, quota, disabled storage). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${APP.storagePrefix}:${key}`);
    return raw === null ? fallback : { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function loadValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${APP.storagePrefix}:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${APP.storagePrefix}:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
