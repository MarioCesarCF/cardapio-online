import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { AuthError, AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { TERMO_VERSAO_ATUAL } from '../../services/termos';

interface MeResponse {
  user: { id: string; name?: string | null; email?: string | null };
  lanchonetes: { id: string; nome: string; slug: string }[];
  cliente: { id: string; nome?: string | null; telefone?: string | null } | null;
  enderecos: unknown[];
  adminSistema: boolean;
  adminSistemaFuncao: string | null;
  termoAceite: { versao: string; aceitoEm: string } | null;
}

const LEMBRAR_KEY = 'auth.lembrar';
const EMAIL_SALVO_KEY = 'auth.email-salvo';
const SENHA_SALVA_KEY = 'auth.senha-salva'; // legado: mantido só para APAGAR dados antigos — nunca mais reescrevemos
const MODO_CADASTRO_KEY = 'auth.modo-cadastro';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Tela = 'login' | 'recuperar' | 'redefinir' | 'termos';
type TipoConta = 'cliente' | 'lojista';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, Button, InputText, Message, SelectButton],
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

  readonly tipoContas = [
    { label: 'Sou cliente', value: 'cliente' },
    { label: 'Quero vender', value: 'lojista' },
  ];

  readonly tela = signal<Tela>('login');
  readonly mode = signal<'login' | 'cadastro'>('login');
  readonly email = signal('');
  readonly password = signal('');
  readonly mostrandoSenha = signal(false);
  readonly lembrar = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly sucesso = signal<string | null>(null);
  readonly redirect = signal<string | null>(null);
  readonly checando = signal(true);

  readonly cadastroNome = signal('');
  readonly cadastroEmail = signal('');
  readonly cadastroSenha = signal('');
  readonly tipoConta = signal<TipoConta>('cliente');
  readonly formularioAceite = signal(false);

  readonly aceiteTela = signal(false);
  readonly termosErro = signal<string | null>(null);

  readonly emailRecuperar = signal('');
  readonly enviandoRecuperar = signal(false);
  readonly recuperarErro = signal<string | null>(null);

  readonly token = signal<string | null>(null);
  readonly novaSenha = signal('');
  readonly confirmarSenha = signal('');
  readonly mostrandoNovaSenha = signal(false);
  readonly enviandoRedefinir = signal(false);
  readonly redefinirErro = signal<string | null>(null);

  ngOnInit(): void {
    this.lembrar.set(localStorage.getItem(LEMBRAR_KEY) === '1');
    if (this.lembrar()) {
      const salvo = localStorage.getItem(EMAIL_SALVO_KEY);
      if (salvo) {
        this.email.set(salvo);
      }
      // Segurança (decisão do dono): a senha NÃO é mais guardada no dispositivo.
      // Aqui apagamos a chave legada (quem tinha "lembrar" ativo antes desta mudança).
      localStorage.removeItem(SENHA_SALVA_KEY);
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
    if (this.auth.isAuthenticated()) {
      try {
        const me = await this.carregarMe();
        if (this.tela() === 'login') {
          await this.aposAutenticar(me, false);
        }
      } catch {
        // erro já exibido por carregarMe
      }
    }
    this.checando.set(false);
  }

  private async posLogin(me: MeResponse): Promise<void> {
    const destino =
      this.redirect() ??
      (me.adminSistema
        ? '/painel-admin'
        : me.lanchonetes.length > 0
          ? '/admin'
          : sessionStorage.getItem(MODO_CADASTRO_KEY) === 'lojista'
            ? '/onboarding'
            : '/home');
    sessionStorage.removeItem(MODO_CADASTRO_KEY);
    if (destino) {
      this.redirect.set(null);
      await this.router.navigateByUrl(destino);
    }
  }

  private async aposAutenticar(me: MeResponse, assinouNoFormulario: boolean): Promise<void> {
    if (this.temTermoAceito(me)) {
      await this.posLogin(me);
      return;
    }
    if (assinouNoFormulario) {
      try {
        await this.registrarConsentimento();
        await this.posLogin(me);
        return;
      } catch {
        // cai na tela de termos para tentar de novo
      }
    }
    this.termosErro.set(null);
    this.aceiteTela.set(false);
    this.tela.set('termos');
  }

  private temTermoAceito(me: MeResponse): boolean {
    return me.termoAceite?.versao === TERMO_VERSAO_ATUAL;
  }

  private async registrarConsentimento(): Promise<void> {
    await firstValueFrom(
      this.api.post<{ ok: boolean }>('/me/consentimento', {
        versao: TERMO_VERSAO_ATUAL,
      }),
    );
  }

  async aceitarTermos(): Promise<void> {
    if (this.submitting() || !this.aceiteTela()) return;
    this.submitting.set(true);
    this.termosErro.set(null);
    try {
      await this.registrarConsentimento();
      const me = await this.carregarMe();
      await this.posLogin(me);
    } catch {
      this.termosErro.set('Não foi possível registrar seu consentimento. Tente novamente.');
    } finally {
      this.submitting.set(false);
    }
  }

  async sairConta(): Promise<void> {
    await this.auth.signOut();
    this.mode.set('login');
    this.formularioAceite.set(false);
    this.aceiteTela.set(false);
    this.termosErro.set(null);
    this.error.set(null);
    this.tela.set('login');
    this.checando.set(false);
  }

  get titulo(): string {
    if (this.tela() === 'recuperar') {
      return 'Recuperar senha';
    }
    if (this.tela() === 'redefinir') {
      return 'Definir nova senha';
    }
    if (this.tela() === 'termos') {
      return 'Aceite os Termos de Uso';
    }
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  get botao(): string {
    return this.mode() === 'login' ? 'Entrar' : 'Criar conta';
  }

  setMode(mode: 'login' | 'cadastro'): void {
    this.mode.set(mode);
    if (mode === 'cadastro') {
      this.cadastroNome.set('');
      this.cadastroEmail.set('');
      this.cadastroSenha.set('');
      this.tipoConta.set('cliente');
      this.formularioAceite.set(false);
    }
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
    // Segurança (decisão do dono): a senha nunca é salva — só limpamos a chave legada.
    localStorage.removeItem(SENHA_SALVA_KEY);
    if (!valor) {
      localStorage.removeItem(EMAIL_SALVO_KEY);
      localStorage.removeItem(SENHA_SALVA_KEY);
    }
  }

  alternarAceiteFormulario(): void {
    this.formularioAceite.set(!this.formularioAceite());
  }

  alternarAceiteTela(): void {
    this.aceiteTela.set(!this.aceiteTela());
  }

  async submit(): Promise<void> {
    if (this.mode() === 'cadastro' && !this.formularioAceite()) {
      this.error.set(
        'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar uma conta.',
      );
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.sucesso.set(null);
    try {
      if (this.mode() === 'login') {
        await this.auth.signIn(this.email(), this.password(), this.lembrar());
        if (this.lembrar()) {
          localStorage.setItem(EMAIL_SALVO_KEY, this.email().trim());
          localStorage.removeItem(SENHA_SALVA_KEY);
        }
      } else {
        await this.auth.signUp(this.cadastroNome(), this.cadastroEmail(), this.cadastroSenha());
        if (this.tipoConta() === 'lojista') {
          sessionStorage.setItem(MODO_CADASTRO_KEY, 'lojista');
        } else {
          sessionStorage.removeItem(MODO_CADASTRO_KEY);
        }
      }
      const me = await this.carregarMe();
      await this.aposAutenticar(me, this.mode() === 'cadastro');
    } catch (error) {
      if (error instanceof AuthError) {
        this.error.set(this.mensagemDeErro(error));
      } else {
        this.error.set('Falha na autenticação. Tente novamente.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private mensagemDeErro(error: AuthError): string {
    if (
      this.mode() === 'cadastro' &&
      /already exists|already register|já existe|in use|em uso|earlier/i.test(error.message)
    ) {
      return 'Já existe uma conta com esse e-mail.';
    }
    if (
      this.mode() === 'login' &&
      /invalid email or password|invalid_credentials|invalid email/i.test(error.message)
    ) {
      return 'E-mail ou senha inválidos.';
    }
    return error.message;
  }

  async entrarComGoogle(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.signInGoogle();
      const me = await this.carregarMe();
      await this.aposAutenticar(me, false);
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
      return await firstValueFrom(this.api.get<MeResponse>('/me'));
    } catch {
      this.error.set('Não foi possível carregar seus dados.');
      throw new AuthError('Não foi possível carregar seus dados.', 0);
    }
  }
}
