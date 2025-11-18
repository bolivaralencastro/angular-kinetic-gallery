import { Injectable, computed, signal } from '@angular/core';
import { createClient, SupabaseClient, Session, User, AuthError } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

interface SupabaseAuthUser {
  readonly id: string;
  readonly email?: string | null;
  readonly [key: string]: unknown;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number; // Epoch seconds
  readonly tokenType: string;
  readonly user: SupabaseAuthUser;
}

interface AuthResult {
  error?: string;
}

export type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

type AuthChangeCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;

export interface SupabaseAuthSubscription {
  unsubscribe: () => void;
}

export interface SupabaseAuthChangePayload {
  data: { subscription: SupabaseAuthSubscription };
}

export interface SupabaseClientLike {
  auth: {
    onAuthStateChange: (callback: AuthChangeCallback) => SupabaseAuthChangePayload;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly adminEmail = environment.supabaseAdminEmail.trim().toLowerCase();
  private readonly storageKey = 'kinetic-auth-session';
  private readonly initializePromise: Promise<void>;
  private readonly authStateListeners = new Set<AuthChangeCallback>();

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
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    this.initializePromise = this.restoreSession();
  }

  getSupabaseClient(): SupabaseClientLike {
    return {
      auth: {
        onAuthStateChange: (callback: AuthChangeCallback): SupabaseAuthChangePayload => {
          callback('INITIAL_SESSION', this.sessionSignal());
          this.authStateListeners.add(callback);
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  this.authStateListeners.delete(callback);
                },
              },
            },
          };
        },
      },
    };
  }

  getRealSupabaseClient(): SupabaseClient {
    return this.supabase;
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
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        return { error: this.translateAuthError(error) };
      }

      if (!data.session) {
        return { error: 'Sessão inválida recebida do servidor.' };
      }

      this.applySupabaseSession(data.session);
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
      const redirectUrl = this.isBrowser() ? window.location.origin : undefined;
      
      const { data, error } = await this.supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        return { error: this.translateAuthError(error) };
      }

      // Se a confirmação de email está habilitada, o usuário precisa verificar o email
      if (data.user && !data.session) {
        return { error: 'Cadastro criado! Verifique seu email para confirmar o acesso.' };
      }

      // Se auto-confirmação está habilitada, a sessão já é retornada
      if (data.session) {
        this.applySupabaseSession(data.session);
      }

      return { error: 'Cadastro criado! Verifique seu email para confirmar o acesso.' };
    } catch (error) {
      console.error('Erro inesperado durante cadastro no Supabase:', error);
      return { error: 'Ocorreu um erro inesperado ao tentar criar a conta.' };
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Erro inesperado ao encerrar sessão no Supabase:', error);
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
      this.setSession(stored, 'INITIAL_SESSION');
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
      this.setSession(refreshed, 'TOKEN_REFRESHED');
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

    this.setSession(session, 'SIGNED_IN');
    cleanup();
    return true;
  }

  private convertSupabaseSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      tokenType: session.token_type ?? 'bearer',
      user: this.convertSupabaseUser(session.user),
    };
  }

  private convertSupabaseUser(user: User): SupabaseAuthUser {
    return {
      id: user.id,
      email: user.email ?? null,
      ...user.user_metadata,
    };
  }

  private applySupabaseSession(session: Session): void {
    const authSession = this.convertSupabaseSession(session);
    this.setSession(authSession, 'SIGNED_IN');
    this.loadingSignal.set(false);
  }

  private translateAuthError(error: AuthError): string {
    const message = error.message.toLowerCase();

    if (message.includes('invalid login credentials')) {
      return 'Email ou senha inválidos.';
    }

    if (message.includes('email not confirmed')) {
      return 'Email ainda não confirmado. Verifique sua caixa de entrada.';
    }

    if (message.includes('user already registered')) {
      return 'Este email já está cadastrado.';
    }

    if (message.includes('invalid email')) {
      return 'Email inválido.';
    }

    return error.message || 'Erro desconhecido durante a autenticação.';
  }

  private emitAuthChange(event: AuthChangeEvent, session: AuthSession | null): void {
    this.authStateListeners.forEach(listener => listener(event, session));
  }

  private setSession(session: AuthSession | null, event?: AuthChangeEvent): void {
    const previous = this.sessionSignal();
    this.sessionSignal.set(session);
    this.persistSession(session);
    this.scheduleRefresh(session);

    const inferredEvent: AuthChangeEvent = event
      ? event
      : session
        ? previous
          ? 'TOKEN_REFRESHED'
          : 'SIGNED_IN'
        : 'SIGNED_OUT';

    this.emitAuthChange(inferredEvent, session);
  }

  private clearSession(): void {
    this.setSession(null, 'SIGNED_OUT');
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
      this.setSession(refreshed, 'TOKEN_REFRESHED');
    } else {
      this.clearSession();
    }
  }

  private async refreshWithToken(refreshToken: string): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        console.warn('Falha ao atualizar sessão do Supabase:', error.message);
        return null;
      }

      if (!data.session) {
        return null;
      }

      return this.convertSupabaseSession(data.session);
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

    const user: SupabaseAuthUser = email ? { id: subject, email } : { id: subject };

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

  private matchesAdminEmail(email: string | null | undefined): boolean {
    if (!this.adminEmail) {
      return false;
    }

    if (!email) {
      return false;
    }

    return email.trim().toLowerCase() === this.adminEmail;
  }
}
