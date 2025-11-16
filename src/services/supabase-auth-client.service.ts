import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';

interface SupabaseAuthSession {
  readonly accessToken: string;
  readonly tokenType: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthClientService {
  private readonly authService = inject(AuthService);

  async getSession(): Promise<SupabaseAuthSession | null> {
    await this.authService.initialize();
    const session = this.authService.session();

    if (!session?.accessToken) {
      return null;
    }

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
    };
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  clearLocalSession(): void {
    this.authService.resetState();
  }
}
