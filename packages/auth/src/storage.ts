export interface AuthStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const noopStorageAdapter: AuthStorageAdapter = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const createWebStorageAdapter = (storage?: Storage | null): AuthStorageAdapter => {
  if (!storage || typeof storage.getItem !== 'function') {
    return noopStorageAdapter;
  }

  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        // Ignore storage write failures.
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage delete failures.
      }
    },
  };
};