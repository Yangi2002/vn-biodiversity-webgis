interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 100,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      this.deleteOldestEntry();
    }

    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }

  clear(): void {
    this.entries.clear();
  }

  private deleteOldestEntry(): void {
    const oldestKey = this.entries.keys().next().value as string | undefined;

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }
}

export function stableCacheKey(namespace: string, value: unknown): string {
  return `${namespace}:${JSON.stringify(sortCacheValue(value))}`;
}

function sortCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortCacheValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortCacheValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}
