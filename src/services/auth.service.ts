import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../environments/environment';

interface SupabaseAuthUser {
  readonly id: string;
  readonly email?: string | null;
  readonly [key: string]: unknown;
}

interface SupabaseAuthResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly user: SupabaseAuthUser;
}

interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number; // Epoch seconds
  readonly tokenType: string;
  readonly user: SupabaseAuthUser;
}

interface AuthResult {
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.supabaseUrl.replace(/\/+$/, '');
  private readonly anonKey = environment.supabaseAnonKey;
  private readonly adminEmail = environment.supabaseAdminEmail.trim().toLowerCase();
  private readonly storageKey = 'kinetic-auth-session';
  private readonly initializePromise: Promise<void>;

  private readonly sessionSignal = signal<AuthSession | null>(null);
  private readonly loadingSignal = signal(true);
  private refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly session = computed(() => this.sessionSignal());
  readonly sessionToken = computed(() => this.sessionSignal()?.accessToken ?? null);
  readonly ownerId = computed(() => this.extractOwnerId(this.sessionSignal()));
  readonly userRole = computed(() => this.extractRole(this.sessionSignal()));
  readonly accessToken = computed(() => this.sessionSignal()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly isLoading = computed(() => this.loadingSignal());
  readonly isAdmin = computed(() => this.matchesAdminEmail(this.sessionSignal()?.user?.email));

  constructor() {
    this.initializePromise = this.restoreSession();
  }

  async initialize(): Promise<void> {
    return this.initializePromise;
  }

  resetState(): void {
    this.clearSession();
    this.loadingSignal.set(false);
  }

  canManageContent(): boolean {
    const role = this.userRole()?.toLowerCase();
    if (role === 'admin') {
      return true;
    }

    return this.isAdmin();
  }

  canManageGallery(ownerId: string): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (this.canManageContent()) {
      return true;
    }

    const normalizedOwnerId = ownerId?.trim();
    const currentOwner = this.ownerId()?.trim();

    return Boolean(normalizedOwnerId && currentOwner && normalizedOwnerId === currentOwner);
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { error: 'Informe email e senha para entrar.' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      if (!response.ok) {
        const errorText = await this.extractError(response);
        return { error: errorText ?? 'Não foi possível realizar o login.' };
      }

      const data = await response.json();
      if (!this.isAuthResponse(data)) {
        return { error: 'Resposta inválida do servidor de autenticação.' };
      }

      this.applySession(data);
      return {};
    } catch (error) {
      console.error('Erro inesperado durante login no Supabase:', error);
      return { error: 'Ocorreu um erro inesperado ao tentar fazer login.' };
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { error: 'Informe email e senha para criar sua conta.' };
    }

    if (trimmedPassword.length < 6) {
      return { error: 'A senha deve ter pelo menos 6 caracteres.' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      if (!response.ok) {
        const errorText = await this.extractError(response);
        return { error: errorText ?? 'Não foi possível criar a conta.' };
      }

      const data = await response.json();
      if (!this.isAuthResponse(data)) {
        return { error: 'Cadastro criado! Verifique seu email para confirmar o acesso.' };
      }

      this.applySession(data);
      return {};
    } catch (error) {
      console.error('Erro inesperado durante cadastro no Supabase:', error);
      return { error: 'Ocorreu um erro inesperado ao tentar criar a conta.' };
    }
  }

  async signOut(): Promise<void> {
    const session = this.sessionSignal();

    if (session) {
      try {
        await fetch(`${this.baseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.anonKey,
            Authorization: `${session.tokenType} ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Erro inesperado ao encerrar sessão no Supabase:', error);
      }
    }

    this.clearSession();
  }

  private async restoreSession(): Promise<void> {
    const hasAppliedUrlSession = this.applySessionFromUrlFragment();
    if (hasAppliedUrlSession) {
      this.loadingSignal.set(false);
      return;
    }

    const stored = this.loadSessionFromStorage();

    if (!stored) {
      this.loadingSignal.set(false);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = stored.expiresAt - now;

    if (secondsUntilExpiry > 120) {
      this.setSession(stored);
      this.loadingSignal.set(false);
      return;
    }

    if (!stored.refreshToken) {
      this.clearSession();
      this.loadingSignal.set(false);
      return;
    }

    const refreshed = await this.refreshWithToken(stored.refreshToken);
    if (refreshed) {
      this.setSession(refreshed);
    } else {
      this.clearSession();
    }

    this.loadingSignal.set(false);
  }

  private applySessionFromUrlFragment(): boolean {
    if (!this.isBrowser()) {
      return false;
    }

    const fragment = window.location.hash.replace(/^#/, '');
    if (!fragment) {
      return false;
    }

    const params = new URLSearchParams(fragment);
    const hasSupabaseParams =
      params.has('access_token') ||
      params.has('refresh_token') ||
      params.has('expires_in') ||
      params.has('token_type');

    if (!hasSupabaseParams) {
      return false;
    }

    const cleanup = () => this.cleanUrlFragment();
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresInRaw = params.get('expires_in');
    const tokenType = params.get('token_type');

    if (!accessToken || !refreshToken || !expiresInRaw || !tokenType) {
      cleanup();
      return false;
    }

    const expiresIn = Number.parseInt(expiresInRaw, 10);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      cleanup();
      return false;
    }

    const user = this.buildUserFromJwt(accessToken);
    if (!user) {
      cleanup();
      return false;
    }

    const session: AuthSession = {
      accessToken,
      refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      tokenType,
      user,
    };

    this.setSession(session);
    cleanup();
    return true;
  }

  private applySession(response: SupabaseAuthResponse): void {
    const session: AuthSession = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + response.expires_in,
      tokenType: response.token_type,
      user: response.user,
    };

    this.setSession(session);
    this.loadingSignal.set(false);
  }

  private setSession(session: AuthSession | null): void {
    this.sessionSignal.set(session);
    this.persistSession(session);
    this.scheduleRefresh(session);
  }

  private clearSession(): void {
    this.sessionSignal.set(null);
    this.persistSession(null);
    this.scheduleRefresh(null);
  }

  handleUnauthorized(): void {
    this.clearSession();
    this.loadingSignal.set(false);
  }

  private async refreshCurrentSession(): Promise<void> {
    const session = this.sessionSignal();
    if (!session || !session.refreshToken) {
      return;
    }

    const refreshed = await this.refreshWithToken(session.refreshToken);
    if (refreshed) {
      this.setSession(refreshed);
    } else {
      this.clearSession();
    }
  }

  private async refreshWithToken(refreshToken: string): Promise<AuthSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const errorText = await this.extractError(response);
        console.warn('Falha ao atualizar sessão do Supabase:', errorText);
        if (response.status === 401) {
          this.handleUnauthorized();
        }
        return null;
      }

      const data = (await response.json()) as SupabaseAuthResponse;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        tokenType: data.token_type,
        user: data.user,
      };
    } catch (error) {
      console.error('Erro inesperado ao atualizar sessão do Supabase:', error);
      return null;
    }
  }

  private scheduleRefresh(session: AuthSession | null): void {
    if (this.refreshTimeoutId !== null) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }

    if (!session) {
      return;
    }

    if (!this.isBrowser()) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = session.expiresAt - now;
    const refreshInSeconds = Math.max(secondsUntilExpiry - 60, 5);

    this.refreshTimeoutId = setTimeout(() => {
      void this.refreshCurrentSession();
    }, refreshInSeconds * 1000);
  }

  private persistSession(session: AuthSession | null): void {
    if (!this.isBrowser()) {
      return;
    }

    try {
      if (!session) {
        window.localStorage.removeItem(this.storageKey);
        return;
      }

      window.localStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch (error) {
      console.error('Erro ao persistir sessão do Supabase no localStorage:', error);
    }
  }

  private loadSessionFromStorage(): AuthSession | null {
    if (!this.isBrowser()) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<AuthSession>;
      if (this.isValidSession(parsed)) {
        return parsed;
      }

      window.localStorage.removeItem(this.storageKey);
      return null;
    } catch (error) {
      console.error('Erro ao restaurar sessão do Supabase do localStorage:', error);
      return null;
    }
  }

  private isValidSession(value: Partial<AuthSession>): value is AuthSession {
    return Boolean(
      value &&
      typeof value.accessToken === 'string' &&
      typeof value.refreshToken === 'string' &&
      typeof value.expiresAt === 'number' &&
      typeof value.tokenType === 'string' &&
      value.user &&
      typeof value.user.id === 'string',
    );
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private extractOwnerId(session: AuthSession | null): string | null {
    if (!session) {
      return null;
    }

    const claims = this.decodeJwtClaims(session.accessToken);
    const claimOwner = this.firstString(
      claims?.owner_id,
      claims?.ownerId,
      claims?.sub,
    );

    if (claimOwner) {
      return claimOwner;
    }

    const userOwner = this.firstString(
      session.user?.owner_id,
      session.user?.ownerId,
      session.user?.id,
    );

    return userOwner ?? null;
  }

  private extractRole(session: AuthSession | null): string | null {
    if (!session) {
      return null;
    }

    const claims = this.decodeJwtClaims(session.accessToken);
    const claimRole = this.firstString(
      claims?.role,
      this.readNested(claims, 'user_role'),
      this.readNested(claims, 'app_metadata', 'role'),
    );

    if (claimRole) {
      return claimRole;
    }

    const userRole = this.firstString(
      session.user?.role,
      this.readNested(session.user, 'role'),
      this.readNested(session.user, 'app_metadata', 'role'),
      this.readNested(session.user, 'user_metadata', 'role'),
    );

    if (userRole) {
      return userRole;
    }

    if (this.matchesAdminEmail(session.user?.email)) {
      return 'admin';
    }

    return null;
  }

  private decodeJwtClaims(token: string): Record<string, unknown> | null {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decodeBase64 = typeof atob === 'function'
        ? atob
        : (value: string) => Buffer.from(value, 'base64').toString('binary');
      const decoded = decodeBase64(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch (error) {
      console.error('Erro ao decodificar JWT do Supabase:', error);
      return null;
    }
  }

  private buildUserFromJwt(token: string): SupabaseAuthUser | null {
    const claims = this.decodeJwtClaims(token);
    if (!claims || typeof claims !== 'object') {
      return null;
    }

    const subject = this.firstString((claims as { sub?: unknown }).sub);
    if (!subject) {
      return null;
    }

    const email = this.firstString(
      this.readNested(claims, 'email'),
      this.readNested(claims, 'user_metadata', 'email'),
    );

    const user: SupabaseAuthUser = { id: subject };
    if (email) {
      user.email = email;
    }

    const userMetadata = this.readNestedObject(claims, 'user_metadata');
    if (userMetadata) {
      (user as Record<string, unknown>).user_metadata = userMetadata;
    }

    return user;
  }

  private firstString(...candidates: ReadonlyArray<unknown>): string | null {
    const first = candidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
    return first ?? null;
  }

  private readNested(value: unknown, ...path: readonly string[]): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' && current.length > 0 ? current : null;
  }

  private readNestedObject(value: unknown, ...path: readonly string[]): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current && typeof current === 'object' ? (current as Record<string, unknown>) : null;
  }

  private cleanUrlFragment(): void {
    if (!this.isBrowser()) {
      return;
    }

    try {
      const newUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, document.title, newUrl);
    } catch (error) {
      console.error('Erro ao limpar parâmetros de autenticação da URL:', error);
    }
  }

  private isAuthResponse(value: unknown): value is SupabaseAuthResponse {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<SupabaseAuthResponse>;
    return (
      typeof candidate.access_token === 'string' &&
      typeof candidate.refresh_token === 'string' &&
      typeof candidate.expires_in === 'number' &&
      typeof candidate.token_type === 'string' &&
      !!candidate.user &&
      typeof candidate.user === 'object' &&
      typeof (candidate.user as { id?: unknown }).id === 'string'
    );
  }

  private matchesAdminEmail(email: string | null | undefined): boolean {
    if (!this.adminEmail) {
      return false;
    }

    if (!email) {
      return false;
    }

    return email.trim().toLowerCase() === this.adminEmail;
  }

  private async extractError(response: Response): Promise<string | null> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json();
        const message = (body as { error?: string; message?: string }).message ?? (body as { error?: string }).error;
        return typeof message === 'string' && message.length > 0 ? message : null;
      }
      const text = await response.text();
      return text || null;
    } catch (error) {
      console.error('Erro ao interpretar resposta de erro do Supabase:', error);
      return null;
    }
  }
}
