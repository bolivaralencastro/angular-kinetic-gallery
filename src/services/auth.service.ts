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

  private readonly sessionSignal = signal<AuthSession | null>(null);
  private readonly loadingSignal = signal(true);
  private refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly session = computed(() => this.sessionSignal());
  readonly accessToken = computed(() => this.sessionSignal()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly isLoading = computed(() => this.loadingSignal());
  readonly isAdmin = computed(() => {
    if (!this.adminEmail) {
      return false;
    }

    const email = this.sessionSignal()?.user?.email ?? '';
    return email.trim().toLowerCase() === this.adminEmail;
  });

  constructor() {
    void this.restoreSession();
  }

  canManageContent(): boolean {
    return this.isAdmin();
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

      const data = (await response.json()) as SupabaseAuthResponse;
      this.applySession(data);
      return {};
    } catch (error) {
      console.error('Erro inesperado durante login no Supabase:', error);
      return { error: 'Ocorreu um erro inesperado ao tentar fazer login.' };
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
