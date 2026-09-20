import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { AuthError, AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

interface MeResponse {
  user: { id: string; name?: string; email?: string };
  lanchonetes: { id: string; nome: string; slug: string }[];
  cliente: { id: string; nome?: string } | null;
  enderecos: unknown[];
  adminSistema: boolean;
}

const OAUTH_PENDENTE_KEY = 'auth.oauth-pendente';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink, Button, InputText, Message, SelectButton],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly modos = [
    { label: 'Entrar', value: 'login' },
    { label: 'Criar conta', value: 'cadastro' },
  ];

  readonly mode = signal<'login' | 'cadastro'>('login');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly me = signal<MeResponse | null>(null);
  readonly redirect = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const destino = params.get('redirect');
      this.redirect.set(destino && destino.startsWith('/') ? destino : null);
    });
    void this.verificaSessao();
  }

  private async verificaSessao(): Promise<void> {
    await this.auth.init();
    if (this.auth.isAuthenticated() && !this.me()) {
      try {
        const me = await this.carregarMe();
        if (this.deveRedirecionar()) {
          await this.posLogin(me);
        }
      } catch {
        // erro já exibido por carregarMe
      }
    }
  }

  private deveRedirecionar(): boolean {
    if (this.redirect()) return true;
    if (sessionStorage.getItem(OAUTH_PENDENTE_KEY)) {
      sessionStorage.removeItem(OAUTH_PENDENTE_KEY);
      return true;
    }
    return false;
  }

  private async posLogin(me: MeResponse): Promise<void> {
    const destino =
      this.redirect() ??
      (me.adminSistema ? '/painel-admin' : me.lanchonetes.length === 0 ? '/onboarding' : '/admin');
    if (destino) {
      this.redirect.set(null);
      await this.router.navigateByUrl(destino);
    }
  }

  get titulo(): string {
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  get botao(): string {
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  setMode(mode: 'login' | 'cadastro'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'login') {
        await this.auth.signIn(this.email(), this.password());
      } else {
        await this.auth.signUp(this.name(), this.email(), this.password());
      }
      const me = await this.carregarMe();
      await this.posLogin(me);
    } catch (error) {
      if (error instanceof AuthError) {
        this.error.set(error.message);
      } else {
        this.error.set('Falha na autenticação. Tente novamente.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async entrarComGoogle(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    sessionStorage.setItem(OAUTH_PENDENTE_KEY, '1');
    try {
      await this.auth.signInGoogle();
      sessionStorage.removeItem(OAUTH_PENDENTE_KEY);
      const me = await this.carregarMe();
      await this.posLogin(me);
    } catch (error) {
      if (error instanceof AuthError) {
        this.error.set(error.message);
      } else {
        this.error.set('Não foi possível entrar com o Google.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async carregarMe(): Promise<MeResponse> {
    try {
      const me = await firstValueFrom(this.api.get<MeResponse>('/me'));
      this.me.set(me);
      return me;
    } catch {
      this.error.set('Não foi possível carregar seus dados.');
      throw new AuthError('Não foi possível carregar seus dados.', 0);
    }
  }

  async sair(): Promise<void> {
    await this.auth.signOut();
    this.me.set(null);
    await this.router.navigate(['/']);
  }
}
