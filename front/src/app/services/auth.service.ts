import { computed, inject, Injectable, signal } from '@angular/core';
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface SessionState {
  user: SessionUser | null;
  token: string | null;
}

export class AuthError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = createAuthClient(environment.neonAuthUrl);
  private readonly api = inject(ApiService);

  readonly session = signal<SessionState>({ user: null, token: null });
  readonly isAuthenticated = computed(() => this.session().token != null);

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.load();
    }
    return this.initPromise;
  }

  private async load(): Promise<void> {
    try {
      const { data } = await this.client.getSession();
      await this.aplicarSessao(data);
    } catch {
      this.session.set({ user: null, token: null });
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.run(() => this.client.signIn.email({ email, password }));
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    await this.run(() => this.client.signUp.email({ name, email, password }));
  }

  async signInGoogle(): Promise<void> {
    await this.run(() =>
      this.client.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/auth`,
      }),
    );
  }

  async signOut(): Promise<void> {
    try {
      await this.client.signOut();
    } finally {
      this.session.set({ user: null, token: null });
    }
  }

  async tokenForRequest(): Promise<string | null> {
    let token = this.session().token;
    if (token && this.isExpiringSoon(token)) {
      await this.refresh();
      token = this.session().token;
    }
    return token;
  }

  async refresh(): Promise<string | null> {
    try {
      const { data } = await this.client.getSession();
      await this.aplicarSessao(data);
    } catch {
      this.session.set({ user: null, token: null });
    }
    return this.session().token;
  }

  private isExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(this.decodePart(token, 1)) as { exp?: number };
      return !payload.exp || payload.exp * 1000 - Date.now() < 60_000;
    } catch {
      return true;
    }
  }

  private decodePart(token: string, part: number): string {
    const raw = token.split('.')[part] ?? '';
    return decodeURIComponent(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'error' in result) {
        const err = (result as { error?: { message?: string } | null }).error;
        if (err) {
          throw new AuthError(err.message ?? 'Falha na autenticação');
        }
      }
      const { data } = await this.client.getSession();
      await this.aplicarSessao(data);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      const apiError = error as { status?: number; code?: string; message?: string };
      throw new AuthError(
        apiError.message ?? 'Falha na autenticação',
        apiError.status,
        apiError.code,
      );
    }
  }

  private async aplicarSessao(
    data: { session?: { token?: string } | null; user?: SessionUser | null } | null,
  ): Promise<void> {
    if (!data?.session?.token) {
      this.session.set({ user: null, token: null });
      return;
    }
    let token = data.session.token;
    if (!this.ehJwt(token)) {
      token = await this.trocarPorJwt(token);
    }
    this.session.set({ user: data.user ?? null, token });
  }

  private async trocarPorJwt(opaco: string): Promise<string> {
    try {
      const body = await firstValueFrom(
        this.api.post<{ token: string }>('/auth/exchange', { token: opaco }),
      );
      if (!body?.token) {
        throw new AuthError('Sessão inválida ou expirada', 401);
      }
      return body.token;
    } catch (error) {
      this.session.set({ user: null, token: null });
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Sessão inválida ou expirada', 401);
    }
  }

  private ehJwt(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    try {
      const payload = JSON.parse(this.decodePart(token, 1)) as {
        sub?: string;
        exp?: number;
      };
      return typeof payload.sub === 'string' && typeof payload.exp === 'number';
    } catch {
      return false;
    }
  }
}
