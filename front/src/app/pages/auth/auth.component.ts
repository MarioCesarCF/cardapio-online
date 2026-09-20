import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthError, AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

interface MeResponse {
  user: { id: string; name?: string | null; email?: string | null };
  lanchonetes: { id: string; nome: string; slug: string }[];
  cliente: { id: string; nome?: string | null; telefone?: string | null } | null;
  enderecos: unknown[];
  adminSistema: boolean;
  adminSistemaFuncao: string | null;
}

const OAUTH_PENDENTE_KEY = 'auth.oauth-pendente';
const LEMBRAR_KEY = 'auth.lembrar';
const EMAIL_SALVO_KEY = 'auth.email-salvo';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Tela = 'login' | 'recuperar' | 'redefinir';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink, Button, InputText, Message, SelectButton, Tag],
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

  readonly nomePlataforma = 'PediJá';
  readonly slogan = 'Seu pedido começa aqui';

  readonly tela = signal<Tela>('login');
  readonly mode = signal<'login' | 'cadastro'>('login');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly mostrandoSenha = signal(false);
  readonly lembrar = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly sucesso = signal<string | null>(null);
  readonly me = signal<MeResponse | null>(null);
  readonly redirect = signal<string | null>(null);

  readonly emailRecuperar = signal('');
  readonly enviandoRecuperar = signal(false);
  readonly recuperarErro = signal<string | null>(null);

  readonly token = signal<string | null>(null);
  readonly novaSenha = signal('');
  readonly confirmarSenha = signal('');
  readonly mostrandoNovaSenha = signal(false);
  readonly enviandoRedefinir = signal(false);
  readonly redefinirErro = signal<string | null>(null);

  readonly perfilNome = signal('');
  readonly perfilTelefone = signal('');
  readonly salvandoPerfil = signal(false);
  readonly perfilErro = signal<string | null>(null);
  readonly perfilSucesso = signal(false);

  ngOnInit(): void {
    this.lembrar.set(localStorage.getItem(LEMBRAR_KEY) === '1');
    if (this.lembrar()) {
      const salvo = localStorage.getItem(EMAIL_SALVO_KEY);
      if (salvo) {
        this.email.set(salvo);
      }
    }
    this.route.queryParamMap.subscribe((params) => {
      const destino = params.get('redirect');
      this.redirect.set(destino && destino.startsWith('/') ? destino : null);
      const token = params.get('token');
      const esqueci = params.get('esqueci');
      if (token) {
        this.token.set(token);
        this.tela.set('redefinir');
      } else if (esqueci === '1') {
        this.tela.set('recuperar');
        if (params.get('error') === 'INVALID_TOKEN') {
          this.recuperarErro.set('O link é inválido ou expirou. Solicite um novo.');
        }
      }
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
      (me.adminSistema ? '/painel-admin' : me.lanchonetes.length > 0 ? '/admin' : '/home');
    if (destino) {
      this.redirect.set(null);
      await this.router.navigateByUrl(destino);
    }
  }

  get titulo(): string {
    if (this.tela() !== 'login') {
      return this.tela() === 'recuperar' ? 'Recuperar senha' : 'Definir nova senha';
    }
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  get botao(): string {
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  setMode(mode: 'login' | 'cadastro'): void {
    this.mode.set(mode);
    this.error.set(null);
    this.sucesso.set(null);
  }

  voltarAoLogin(): void {
    this.tela.set('login');
    this.recuperarErro.set(null);
    this.error.set(null);
    this.sucesso.set(null);
  }

  abrirRecuperacao(): void {
    this.tela.set('recuperar');
    this.recuperarErro.set(null);
    this.sucesso.set(null);
    if (!this.emailRecuperar()) {
      this.emailRecuperar.set(this.email());
    }
  }

  alternarSenha(): void {
    this.mostrandoSenha.set(!this.mostrandoSenha());
  }

  alternarNovaSenha(): void {
    this.mostrandoNovaSenha.set(!this.mostrandoNovaSenha());
  }

  alternarLembrar(): void {
    const valor = !this.lembrar();
    this.lembrar.set(valor);
    localStorage.setItem(LEMBRAR_KEY, valor ? '1' : '0');
    if (valor && this.email()) {
      localStorage.setItem(EMAIL_SALVO_KEY, this.email().trim());
    }
    if (!valor) {
      localStorage.removeItem(EMAIL_SALVO_KEY);
    }
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    this.sucesso.set(null);
    try {
      if (this.mode() === 'login') {
        await this.auth.signIn(this.email(), this.password(), this.lembrar());
        if (this.lembrar()) {
          localStorage.setItem(EMAIL_SALVO_KEY, this.email().trim());
        }
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

  async enviarLinkRecuperacao(): Promise<void> {
    if (this.enviandoRecuperar()) return;
    const email = this.emailRecuperar().trim();
    this.recuperarErro.set(null);

    if (!EMAIL_REGEX.test(email)) {
      this.recuperarErro.set('Informe um e-mail válido.');
      return;
    }

    this.enviandoRecuperar.set(true);
    try {
      const registrado = await this.auth.verificarEmailCadastrado(email);
      if (!registrado) {
        this.recuperarErro.set('E-mail não cadastrado na plataforma.');
        return;
      }
      await this.auth.solicitarRedefinicaoSenha(email);
      this.email.set(email);
      this.recuperarErro.set(null);
      this.voltarAoLogin();
      this.sucesso.set(
        'Enviamos um link de redefinição para seu e-mail. Confira sua caixa de entrada.',
      );
    } catch (error) {
      if (error instanceof AuthError) {
        this.recuperarErro.set(error.message);
      } else {
        this.recuperarErro.set('Não foi possível enviar o link. Tente novamente.');
      }
    } finally {
      this.enviandoRecuperar.set(false);
    }
  }

  async redefinir(): Promise<void> {
    if (this.enviandoRedefinir()) return;
    const senha = this.novaSenha();
    this.redefinirErro.set(null);

    if (senha.length < 8) {
      this.redefinirErro.set('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== this.confirmarSenha()) {
      this.redefinirErro.set('As senhas não conferem.');
      return;
    }

    this.enviandoRedefinir.set(true);
    try {
      await this.auth.redefinirSenha(senha, this.token() ?? '');
      this.token.set(null);
      this.novaSenha.set('');
      this.confirmarSenha.set('');
      this.voltarAoLogin();
      this.sucesso.set('Senha redefinida com sucesso. Entre com a nova senha.');
    } catch (error) {
      if (error instanceof AuthError) {
        this.redefinirErro.set(
          error.status === 400 || error.code === 'INVALID_TOKEN'
            ? 'O link é inválido ou expirou. Solicite um novo.'
            : error.message,
        );
      } else {
        this.redefinirErro.set('Não foi possível redefinir a senha. Tente novamente.');
      }
    } finally {
      this.enviandoRedefinir.set(false);
    }
  }

  async carregarMe(): Promise<MeResponse> {
    try {
      const me = await firstValueFrom(this.api.get<MeResponse>('/me'));
      this.me.set(me);
      this.perfilNome.set(me.user.name ?? me.cliente?.nome ?? '');
      this.perfilTelefone.set(me.cliente?.telefone ?? '');
      return me;
    } catch {
      this.error.set('Não foi possível carregar seus dados.');
      throw new AuthError('Não foi possível carregar seus dados.', 0);
    }
  }

  async salvarPerfil(): Promise<void> {
    if (this.salvandoPerfil()) return;
    const nome = this.perfilNome().trim().replace(/\s+/g, ' ');
    const telefoneBruto = this.perfilTelefone().trim();
    const telefone = telefoneBruto.replace(/\D/g, '');

    this.perfilErro.set(null);
    this.perfilSucesso.set(false);

    if (nome.length < 2 || nome.length > 80) {
      this.perfilErro.set('O nome deve ter entre 2 e 80 caracteres.');
      return;
    }
    if (telefoneBruto !== '' && !/^\d{10,13}$/.test(telefone)) {
      this.perfilErro.set('WhatsApp inválido. Informe o número com DDD.');
      return;
    }

    this.salvandoPerfil.set(true);
    try {
      await firstValueFrom(
        this.api.patch('/me', {
          nome,
          telefone: telefoneBruto === '' ? '' : telefone,
        }),
      );
      this.perfilSucesso.set(true);
      const me = this.me();
      if (me) {
        this.me.set({
          ...me,
          user: { ...me.user, name: nome },
          cliente: { ...(me.cliente ?? { id: me.user.id }), nome, telefone: telefone || null },
        });
      }
    } catch {
      this.perfilErro.set('Não foi possível salvar. Tente novamente.');
    } finally {
      this.salvandoPerfil.set(false);
    }
  }

  abrirPainel(): void {
    void this.router.navigate(['/painel-admin']);
  }

  async sair(): Promise<void> {
    await this.auth.signOut();
    this.me.set(null);
    await this.router.navigate(['/']);
  }
}
