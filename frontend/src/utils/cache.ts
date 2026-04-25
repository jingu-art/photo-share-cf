const TTL = 5 * 60 * 1000;

interface Entry<T> {
  data: T;
  ts: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: Entry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full
  }
}

export function invalidateCache(key: string): void {
  localStorage.removeItem(key);
}
