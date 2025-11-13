export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  maxSize: number;
}

export interface Cache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  size: () => number;
}

export const createCache = <T>(options: CacheOptions): Cache<T> => {
  const store: Map<string, CacheEntry<T>> = new Map();
  const { ttl, maxSize }: CacheOptions = options;

  const evictExpired = (): void => {
    const now: number = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < now) {
        store.delete(key);
      }
    }
  };

  const evictOldest = (): void => {
    if (store.size >= maxSize) {
      const firstKey: string | undefined = store.keys().next().value;
      if (firstKey !== undefined) {
        store.delete(firstKey);
      }
    }
  };

  return {
    get: (key: string): T | undefined => {
      evictExpired();
      const entry: CacheEntry<T> | undefined = store.get(key);
      if (entry === undefined) {
        return undefined;
      }
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set: (key: string, value: T): void => {
      evictExpired();
      evictOldest();
      const entry: CacheEntry<T> = {
        value,
        expiresAt: Date.now() + ttl,
      };
      store.set(key, entry);
    },

    has: (key: string): boolean => {
      const value: T | undefined = createCache(options).get(key);
      return value !== undefined;
    },

    delete: (key: string): boolean => {
      return store.delete(key);
    },

    clear: (): void => {
      store.clear();
    },

    size: (): number => {
      evictExpired();
      return store.size;
    },
  };
};
