import type { AuthStorageAdapter } from './storage';

const CURRENT_USER_KEY = 'currentUser';
const AUTH_TOKEN_KEY = 'authToken';

type Awaitable<T> = T | Promise<T>;

export interface StoredAuthUser {
  id: string;
  email?: string | null;
  user_type?: string | null;
  role?: string | null;
  token?: string | null;
  [key: string]: unknown;
}

export interface AuthSessionOptions {
  userStorage: AuthStorageAdapter;
  tokenStorage?: AuthStorageAdapter;
  userKey?: string;
  tokenKey?: string;
  setUserContext?: (userId: string | null) => Awaitable<void>;
}

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');

  if (typeof atob === 'function') {
    return decodeURIComponent(
      atob(normalized)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  }

  return Buffer.from(normalized, 'base64').toString('utf-8');
};

const decodeStoredAuthToken = (token: string | null) => {
  try {
    if (!token) return null;

    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;

    const payload = JSON.parse(decodeBase64Url(payloadSegment));
    if (!payload?.sub) return null;

    return {
      id: payload.sub,
      email: payload.email || null,
      user_type: payload.user_type || 'client',
      role: payload.user_type === 'admin' ? 'admin' : 'user',
    } satisfies StoredAuthUser;
  } catch {
    return null;
  }
};

export class AuthSession {
  private readonly userStorage: AuthStorageAdapter;
  private readonly tokenStorage: AuthStorageAdapter;
  private readonly userKey: string;
  private readonly tokenKey: string;
  private readonly setUserContext?: AuthSessionOptions['setUserContext'];
  private readonly listeners = new Set<(user: StoredAuthUser | null) => void>();
  private hydrated = false;
  private currentAuthUser: StoredAuthUser | null = null;

  constructor(options: AuthSessionOptions) {
    this.userStorage = options.userStorage;
    this.tokenStorage = options.tokenStorage || options.userStorage;
    this.userKey = options.userKey || CURRENT_USER_KEY;
    this.tokenKey = options.tokenKey || AUTH_TOKEN_KEY;
    this.setUserContext = options.setUserContext;
  }

  get currentUser() {
    return this.currentAuthUser;
  }

  async getStoredAuthToken() {
    return (await this.tokenStorage.getItem(this.tokenKey)) || null;
  }

  async getStoredCurrentUser() {
    const storedUser = await this.userStorage.getItem(this.userKey);
    if (storedUser) {
      try {
        return JSON.parse(storedUser) as StoredAuthUser;
      } catch {
        await this.userStorage.removeItem(this.userKey);
      }
    }

    return decodeStoredAuthToken(await this.getStoredAuthToken());
  }

  async init() {
    const user = await this.getStoredCurrentUser();
    this.currentAuthUser = user;

    if (user) {
      await this.userStorage.setItem(this.userKey, JSON.stringify(user));
    }

    if (this.setUserContext) {
      await this.setUserContext(user?.id || null);
    }

    this.hydrated = true;
    this.emit();
  }

  async setCurrentUser(user: StoredAuthUser | null) {
    this.currentAuthUser = user;

    if (user) {
      const token = user.token || (await this.getStoredAuthToken());
      const { token: _token, ...safeUser } = user;
      await this.userStorage.setItem(this.userKey, JSON.stringify(safeUser));
      if (token) {
        await this.tokenStorage.setItem(this.tokenKey, token);
      }
    } else {
      await this.userStorage.removeItem(this.userKey);
      await this.tokenStorage.removeItem(this.tokenKey);
    }

    if (this.setUserContext) {
      await this.setUserContext(user?.id || null);
    }

    this.hydrated = true;
    this.emit();
    return user;
  }

  async getUser() {
    if (!this.hydrated) {
      await this.init();
    }

    if (this.currentAuthUser) {
      return {
        data: { user: this.currentAuthUser },
        error: null,
      };
    }

    return {
      data: { user: null },
      error: { message: 'Not authenticated' },
    };
  }

  async signOut() {
    await this.setCurrentUser(null);
    return { error: null };
  }

  onAuthStateChange(callback: (user: StoredAuthUser | null) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.currentAuthUser);
    }
  }
}

export const createAuthSession = (options: AuthSessionOptions) => new AuthSession(options);