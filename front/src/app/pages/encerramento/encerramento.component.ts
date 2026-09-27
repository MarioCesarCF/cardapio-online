import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { AdminService } from '../../services/admin.service';
import {
  AJUDOU_PEDIDOS,
  EncerramentoService,
  FATORES_LANCHONETE,
  MAX_SECUNDARIOS,
  MOTIVOS_CLIENTE,
  MOTIVOS_LANCHONETE,
  PRECO_ADEQUADO,
  SATISFACAO,
  VOLTARIA,
  type PerfilEncerramento,
  type RespostaEncerramentoPayload,
} from '../../services/encerramento';

// Tempo de exibição do agradecimento antes de sair da página.
const SAIR_EM_MS = 1800;

@Component({
  selector: 'app-encerramento',
  imports: [FormsModule, Button, InputText, Textarea],
  template: `
    <div class="enc">
      @if (finalizado()) {
        <section class="enc__obrigado superficie">
          <h1>Obrigado pelo feedback!</h1>
          <p>
            Sua resposta já foi registrada e ajuda a gente a melhorar o Peditto. Você será
            redirecionado em instantes.
          </p>
        </section>
      } @else {
        <section class="enc__card superficie">
          <h1>
            {{ ehLanchonete() ? 'Encerrar lanchonete' : 'Encerrar conta' }}
          </h1>
          <p class="enc__intro">
            {{ nomeAlvo() }}
            Vamos à última parte.
          </p>

          @if (etapa() === 'confirmar') {
            <div class="enc__aviso">
              <i class="pi pi-info-circle"></i>
              <div>
                @if (ehLanchonete()) {
                  <p>
                    Ao encerrar, a lanchonete <strong>{{ nomeAlvo() }}</strong> e todo o cardápio
                    saem do ar e deixam de ser editáveis.
                  </p>
                  <p class="enc__nota">
                    Lanchonetes que já receberam pedidos não podem ser excluídas — nesse caso o
                    encerramento é recusado e você pode pausar a loja por aqui mesmo.
                  </p>
                } @else {
                  <p>
                    Isso apaga seu nome, WhatsApp, e-mail, endereços salvos e o histórico de
                    favoritos. Os pedidos que você fez continuam visíveis para a lanchonete, mas sem
                    identificar mais quem você é.
                  </p>
                  <p class="enc__nota">
                    Se você ainda tem algum pedido em andamento (recebido, em preparo ou a caminho),
                    o encerramento é recusado até a entrega ou o cancelamento — a lanchonete precisa
                    do seu contato para concluir.
                  </p>
                }
              </div>
            </div>
            <div class="enc__acoes">
              <p-button
                label="Voltar"
                icon="pi pi-arrow-left"
                severity="secondary"
                [outlined]="true"
                (onClick)="voltar()"
              />
              <p-button
                [label]="
                  ehLanchonete() ? 'Sim, encerrar a lanchonete' : 'Sim, encerrar minha conta'
                "
                icon="pi pi-arrow-right"
                iconPos="right"
                severity="danger"
                (onClick)="avancarParaQuestionario()"
              />
            </div>
          } @else {
            <div class="enc__bloco">
              <h2>
                {{
                  ehLanchonete()
                    ? 'Questionário de encerramento — Lanchonetes'
                    : 'Questionário de encerramento — Clientes'
                }}
              </h2>
              <p class="enc__dica">
                Seu feedback ajuda a gente a melhorar o Peditto. Este questionário é
                <strong>opcional</strong> e leva menos de
                {{ ehLanchonete() ? '2 minutos' : '1 minuto' }}.
              </p>
            </div>

            <fieldset class="enc__pergunta">
              <legend>
                Qual é o principal motivo para
                {{ ehLanchonete() ? 'você encerrar sua lanchonete' : 'você encerrar sua conta' }}?
                <em>obrigatório</em>
              </legend>
              <div class="enc__opcoes">
                @for (opcao of motivos(); track opcao.valor) {
                  <label class="enc__opcao" [class.enc__opcao--erro]="erros()['motivo']">
                    <input
                      type="radio"
                      name="motivo"
                      [value]="opcao.valor"
                      [checked]="motivo() === opcao.valor"
                      (change)="definirMotivo(opcao.valor)"
                    />
                    <span>{{ opcao.rotulo }}</span>
                  </label>
                }
              </div>
              @if (erros()['motivo']; as erro) {
                <p class="enc__erro">{{ erro }}</p>
              }
            </fieldset>

            @if (ehLanchonete()) {
              <fieldset class="enc__pergunta">
                <legend>2. O que mais influenciou sua decisão? <em>obrigatório</em></legend>
                <p class="enc__contador">
                  Escolha até {{ MAX_SECUNDARIOS }} — {{ secundarios().length }} selecionado(s).
                </p>
                <div class="enc__grade">
                  @for (fator of fatores; track fator.valor) {
                    <label class="enc__opcao" [class.enc__opcao--off]="secundariosCheios()">
                      <input
                        type="checkbox"
                        [value]="fator.valor"
                        [checked]="secundarios().includes(fator.valor)"
                        [disabled]="secundariosCheios() && !secundarios().includes(fator.valor)"
                        (change)="alternarSecundario(fator.valor)"
                      />
                      <span>{{ fator.rotulo }}</span>
                    </label>
                  }
                </div>
                @if (erros()['secundarios']; as erro) {
                  <p class="enc__erro">{{ erro }}</p>
                }
              </fieldset>

              @if (mostrarPreco()) {
                <fieldset class="enc__pergunta">
                  <legend>
                    2.1 Qual valor mensal você consideraria adequado para o Peditto?
                    <em>obrigatório</em>
                  </legend>
                  <div class="enc__opcoes">
                    @for (faixa of precos; track faixa.valor) {
                      <label class="enc__opcao" [class.enc__opcao--erro]="erros()['preco']">
                        <input
                          type="radio"
                          name="preco"
                          [value]="faixa.valor"
                          [checked]="precoAdequado() === faixa.valor"
                          (change)="marcarPreco(faixa.valor)"
                        />
                        <span>{{ faixa.rotulo }}</span>
                      </label>
                    }
                  </div>
                  @if (erros()['preco']; as erro) {
                    <p class="enc__erro">{{ erro }}</p>
                  }
                </fieldset>
              }

              @if (mostrarFuncionalidade()) {
                <label class="enc__campo">
                  <span>2.2 Qual funcionalidade está faltando?</span>
                  <input
                    pInputText
                    type="text"
                    maxlength="1000"
                    [value]="funcionalidadeFaltante()"
                    (input)="funcionalidadeFaltante.set($any($event.target).value)"
                    placeholder="Ex.: integração com o Instagram"
                  />
                </label>
              }

              <fieldset class="enc__pergunta">
                <legend>
                  3. O Peditto ajudou sua lanchonete a receber pedidos?
                  <em>obrigatório</em>
                </legend>
                <div class="enc__opcoes">
                  @for (opcao of ajudou; track opcao.valor) {
                    <label class="enc__opcao" [class.enc__opcao--erro]="erros()['ajudou']">
                      <input
                        type="radio"
                        name="ajudou"
                        [value]="opcao.valor"
                        [checked]="ajudouPedidos() === opcao.valor"
                        (change)="marcarAjuda(opcao.valor)"
                      />
                      <span>{{ opcao.rotulo }}</span>
                    </label>
                  }
                </div>
                @if (erros()['ajudou']; as erro) {
                  <p class="enc__erro">{{ erro }}</p>
                }
              </fieldset>
            }

            <label class="enc__campo">
              <span>
                {{ ehLanchonete() ? '4.' : '2.' }} O que você gostaria que o Peditto tivesse ou
                fizesse melhor?
                <em>opcional</em>
              </span>
              <textarea
                pTextarea
                rows="3"
                maxlength="1000"
                [value]="melhorar()"
                (input)="melhorar.set($any($event.target).value)"
                placeholder="Conta o que faria diferença para você."
              ></textarea>
            </label>

            @if (ehLanchonete()) {
              <label class="enc__campo">
                <span
                  >5. O que poderia ter feito você continuar usando o Peditto?
                  <em>opcional</em></span
                >
                <textarea
                  pTextarea
                  rows="3"
                  maxlength="1000"
                  [value]="paraContinuar()"
                  (input)="paraContinuar.set($any($event.target).value)"
                  placeholder="Conta o que faltou para você ficar."
                ></textarea>
              </label>
            }

            <fieldset class="enc__pergunta">
              <legend>
                {{ ehLanchonete() ? '6.' : '3.' }} Como foi sua experiência geral com o Peditto?
                @if (!ehLanchonete()) {
                  <em>obrigatório</em>
                }
              </legend>
              <div class="enc__escala">
                @for (nota of notas; track nota.valor) {
                  <button
                    type="button"
                    class="enc__nota"
                    [class.enc__nota--ativa]="satisfacao() === nota.valor"
                    [class.enc__nota--erro]="erros()['satisfacao']"
                    (click)="marcarNota(nota.valor)"
                  >
                    <span class="enc__emoji">{{ nota.emoji }}</span>
                    <span class="enc__nota-rotulo">{{ nota.rotulo }}</span>
                  </button>
                }
              </div>
              @if (erros()['satisfacao']; as erro) {
                <p class="enc__erro">{{ erro }}</p>
              }
            </fieldset>

            <fieldset class="enc__pergunta">
              <legend>
                {{ ehLanchonete() ? '7.' : '4.' }}
                {{
                  ehLanchonete()
                    ? 'Você consideraria voltar a usar o Peditto no futuro?'
                    : 'Você usaria o Peditto novamente no futuro?'
                }}
              </legend>
              <div class="enc__opcoes enc__opcoes--linha">
                @for (opcao of listaVoltar; track opcao.valor) {
                  <label class="enc__opcao">
                    <input
                      type="radio"
                      name="voltaria"
                      [value]="opcao.valor"
                      [checked]="voltaria() === opcao.valor"
                      (change)="definirVoltaria(opcao.valor)"
                    />
                    <span>{{ opcao.rotulo }}</span>
                  </label>
                }
              </div>
            </fieldset>

            @if (ehLanchonete()) {
              <fieldset class="enc__pergunta">
                <legend>8. Podemos entrar em contato para entender melhor seu feedback?</legend>
                <div class="enc__opcoes enc__opcoes--linha">
                  <label class="enc__opcao">
                    <input
                      type="radio"
                      name="contato"
                      [checked]="contatoLiberado()"
                      (change)="contatoLiberado.set(true)"
                    />
                    <span>Sim</span>
                  </label>
                  <label class="enc__opcao">
                    <input
                      type="radio"
                      name="contato"
                      [checked]="!contatoLiberado()"
                      (change)="contatoLiberado.set(false)"
                    />
                    <span>Não</span>
                  </label>
                </div>
                @if (contatoLiberado()) {
                  <label class="enc__campo">
                    <span>Como prefere ser contatado? <em>opcional</em></span>
                    <input
                      pInputText
                      type="text"
                      maxlength="120"
                      [value]="contato()"
                      (input)="contato.set($any($event.target).value)"
                      [placeholder]="contatoSugerido() || 'WhatsApp com DDD ou e-mail'"
                    />
                  </label>
                }
              </fieldset>
            } @else {
              <label class="enc__campo">
                <span
                  >5. Se quiser, conte um pouco mais sobre sua experiência. <em>opcional</em></span
                >
                <textarea
                  pTextarea
                  rows="3"
                  maxlength="1000"
                  [value]="experiencia()"
                  (input)="experiencia.set($any($event.target).value)"
                  placeholder="Conta o que rolou, se quiser."
                ></textarea>
              </label>
            }

            @if (erroGeral(); as erro) {
              <p class="enc__erro enc__erro--geral">
                <i class="pi pi-exclamation-circle"></i> {{ erro }}
              </p>
            }

            <div class="enc__acoes enc__acoes--fim">
              <p-button
                label="Voltar"
                icon="pi pi-arrow-left"
                severity="secondary"
                [outlined]="true"
                [disabled]="enviando()"
                (onClick)="etapa.set('confirmar')"
              />
              <p-button
                [label]="enviando() ? 'Encerrando…' : 'Encerrar conta sem responder'"
                severity="secondary"
                [outlined]="true"
                [disabled]="enviando()"
                (onClick)="encerrar(false)"
              />
              <p-button
                [label]="enviando() ? 'Enviando…' : 'Enviar e encerrar conta'"
                icon="pi pi-send"
                severity="danger"
                [loading]="enviando()"
                (onClick)="encerrar(true)"
              />
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .enc {
      max-width: 46rem;
      margin: 0 auto;
      padding: 20px 16px 40px;
    }
    .enc__card {
      display: grid;
      gap: 18px;
      padding: 20px;
    }
    h1 {
      margin: 0;
      font-size: 1.4rem;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 1.1rem;
    }
    .enc__intro,
    .enc__dica {
      margin: 0;
      color: var(--app-texto-suave);
      font-size: 0.9rem;
    }
    .enc__dica strong {
      color: var(--app-texto);
    }
    .enc__bloco {
      display: grid;
      gap: 2px;
    }
    .enc__aviso {
      display: flex;
      gap: 0.7rem;
      padding: 0.9rem 1rem;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: color-mix(in srgb, var(--p-primary-color) 8%, var(--app-superficie));
    }
    .enc__aviso p {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .enc__aviso p:last-child {
      margin-bottom: 0;
    }
    .enc__nota {
      color: var(--app-texto-suave);
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      display: grid;
      gap: 0.6rem;
    }
    legend {
      padding: 0;
      font-size: 0.95rem;
      font-weight: 600;
      line-height: 1.4;
    }
    legend em,
    .enc__campo span em {
      font-style: normal;
      font-weight: 400;
      color: var(--app-texto-suave);
      font-size: 0.82rem;
    }
    .enc__opcoes,
    .enc__grade {
      display: grid;
      gap: 0.4rem;
    }
    .enc__grade {
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    }
    .enc__opcoes--linha {
      grid-auto-flow: column;
      justify-content: start;
      gap: 1.2rem;
    }
    .enc__opcao {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      font-size: 0.9rem;
      cursor: pointer;
    }
    .enc__opcao:hover {
      border-color: var(--p-primary-color);
    }
    .enc__opcao--erro {
      border-color: var(--p-danger-color, #e24a4a);
      box-shadow: inset 0 0 0 1px var(--p-danger-color, #e24a4a);
    }
    .enc__opcao--off {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .enc__contador {
      margin: 0;
      font-size: 0.82rem;
      color: var(--app-texto-suave);
    }
    .enc__escala {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.4rem;
    }
    .enc__nota {
      display: grid;
      justify-items: center;
      gap: 2px;
      padding: 0.55rem 0.2rem;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .enc__nota--ativa {
      border-color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
    }
    .enc__nota--erro {
      border-color: var(--p-danger-color, #e24a4a);
    }
    .enc__emoji {
      font-size: 1.4rem;
      line-height: 1.2;
    }
    .enc__nota-rotulo {
      font-size: 0.7rem;
      text-align: center;
      color: var(--app-texto-suave);
    }
    .enc__campo {
      display: grid;
      gap: 0.35rem;
    }
    .enc__campo > span {
      font-size: 0.95rem;
      font-weight: 600;
      line-height: 1.4;
    }
    .enc__campo textarea {
      width: 100%;
      resize: vertical;
    }
    .enc__erro {
      margin: 0;
      color: var(--p-danger-color, #e24a4a);
      font-size: 0.82rem;
    }
    .enc__erro--geral {
      padding: 0.7rem 0.85rem;
      border: 1px solid var(--p-danger-color, #e24a4a);
      border-radius: var(--app-raio-sm);
      font-size: 0.88rem;
    }
    .enc__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .enc__acoes--fim {
      justify-content: space-between;
      padding-top: 0.4rem;
      border-top: 1px solid var(--app-borda);
    }
    .enc__obrigado {
      display: grid;
      gap: 0.6rem;
      padding: 2rem 1.4rem;
      text-align: center;
    }
    .enc__obrigado h1 {
      font-size: 1.3rem;
    }
    .enc__obrigado p {
      margin: 0;
      color: var(--app-texto-suave);
    }
  `,
})
export class EncerramentoComponent implements OnDestroy {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly perfil = inject(PerfilService);
  private readonly admin = inject(AdminService);
  private readonly encerramento = inject(EncerramentoService);
  private readonly toast = inject(MessageService);

  // Catálogos como campo do componente: o template Angular não enxerga const
  // de módulo (mesma razão dos filtros do painel).
  readonly fatores = FATORES_LANCHONETE;
  readonly ajudou = AJUDOU_PEDIDOS;
  readonly precos = PRECO_ADEQUADO;
  readonly notas = SATISFACAO;
  // Nome com prefixo para não colidir com o signal de resposta `voltaria`.
  readonly listaVoltar = VOLTARIA;
  readonly MAX_SECUNDARIOS = MAX_SECUNDARIOS;

  private readonly perfilAtual = signal<PerfilEncerramento>('cliente');
  private readonly slug = signal<string | null>(null);

  readonly etapa = signal<'confirmar' | 'questionario'>('confirmar');
  readonly enviando = signal(false);
  readonly finalizado = signal(false);
  readonly erroGeral = signal<string | null>(null);
  readonly erros = signal<Record<string, string>>({});

  readonly motivo = signal<string>('');
  readonly secundarios = signal<string[]>([]);
  readonly ajudouPedidos = signal<string>('');
  readonly precoAdequado = signal<string>('');
  readonly funcionalidadeFaltante = signal('');
  // String (e não number) porque o catálogo `notas` traz '1'..'5'; a conversão
  // para número acontece só no payload.
  readonly satisfacao = signal<string>('');
  readonly voltaria = signal<string>('');
  readonly contatoLiberado = signal(false);
  readonly contato = signal('');
  readonly contatoSugerido = signal('');
  readonly melhorar = signal('');
  readonly paraContinuar = signal('');
  readonly experiencia = signal('');

  readonly ehLanchonete = computed(() => this.perfilAtual() === 'lanchonete');
  readonly motivos = computed(() => (this.ehLanchonete() ? MOTIVOS_LANCHONETE : MOTIVOS_CLIENTE));
  readonly mostrarPreco = computed(() => this.ehLanchonete() && this.motivo() === 'preco');
  readonly mostrarFuncionalidade = computed(
    () => this.ehLanchonete() && this.motivo() === 'falta_recurso',
  );
  readonly secundariosCheios = computed(() => this.secundarios().length >= MAX_SECUNDARIOS);
  readonly nomeAlvo = computed(() => {
    if (!this.ehLanchonete()) return 'Antes de você ir:';
    const slug = this.slug();
    const loja = this.perfil.dados()?.lanchonetes.find((l) => l.slug === slug);
    return loja ? `Lanchonete: ${loja.nome}. Antes de você ir:` : 'Antes de você ir:';
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const params = this.rota.snapshot.queryParamMap;
    const pedido = params.get('perfil');
    const slug = params.get('slug');
    if (pedido === 'lanchonete' && slug) {
      this.perfilAtual.set('lanchonete');
      this.slug.set(slug);
    } else {
      this.perfilAtual.set('cliente');
    }
  }

  definirMotivo(valor: string): void {
    this.motivo.set(valor);
    this.limparErro('motivo');
    // Saiu do motivo "preco"/"falta_recurso"? A pergunta condicional some com ele.
    if (!this.mostrarPreco()) this.precoAdequado.set('');
    if (!this.mostrarFuncionalidade()) this.funcionalidadeFaltante.set('');
  }

  alternarSecundario(valor: string): void {
    const atuais = this.secundarios();
    if (atuais.includes(valor)) {
      this.secundarios.set(atuais.filter((v) => v !== valor));
    } else if (atuais.length < MAX_SECUNDARIOS) {
      this.secundarios.set([...atuais, valor]);
    }
    if (this.secundarios().length > 0) this.limparErro('secundarios');
  }

  marcarPreco(valor: string): void {
    this.precoAdequado.set(valor);
    this.limparErro('preco');
  }

  marcarAjuda(valor: string): void {
    this.ajudouPedidos.set(valor);
    this.limparErro('ajudou');
  }

  marcarNota(valor: string): void {
    this.satisfacao.set(valor);
    this.limparErro('satisfacao');
  }

  definirVoltaria(valor: string): void {
    this.voltaria.set(valor);
  }

  avancarParaQuestionario(): void {
    if (this.ehLanchonete() && this.contatoSugerido() === '') {
      void this.sugerirContato();
    }
    this.etapa.set('questionario');
  }

  voltar(): void {
    void this.router.navigate([this.ehLanchonete() ? '/admin' : '/home']);
  }

  /**
   * Fecha a conta. `responder = false` encerra sem gravar questionário — é o
   * caminho de um clique, e nunca some.
   */
  async encerrar(responder: boolean): Promise<void> {
    if (this.enviando()) return;
    if (responder && !this.valida()) return;

    this.enviando.set(true);
    this.erroGeral.set(null);

    if (responder) {
      try {
        await this.envia();
      } catch (erro) {
        // Falha no questionário NÃO pode segurar o encerramento: avisa e segue.
        this.toast.add({
          severity: 'warn',
          summary: 'Feedback não enviado',
          detail: 'Sua conta será encerrada mesmo assim.',
          life: 4000,
        });
      }
    }

    try {
      if (this.ehLanchonete()) {
        await this.admin.removeLanchonete(this.slug() as string);
        this.perfil.limpar();
        this.finalizado.set(true);
        this.agendarSaida('/admin');
        return;
      }
      await this.api.delete('/me/conta');
      await this.auth.signOut();
      this.perfil.limpar();
      this.finalizado.set(true);
      this.agendarSaida('/');
    } catch (erro) {
      this.erroGeral.set(this.mensagemDeErro(erro));
    } finally {
      this.enviando.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async envia(): Promise<void> {
    const payload = this.montaPayload();
    const slug = this.slug();
    if (this.ehLanchonete() && slug) {
      await this.encerramento.registrarLanchonete(slug, payload);
      return;
    }
    await this.encerramento.registrarCliente(payload);
  }

  private montaPayload(): RespostaEncerramentoPayload {
    const texto = (valor: string) => (valor.trim() === '' ? undefined : valor.trim());
    const payload: RespostaEncerramentoPayload = {
      motivoPrincipal: this.motivo(),
      melhorar: texto(this.melhorar()),
    };
    if (this.ehLanchonete()) {
      payload.motivosSecundarios = this.secundarios();
      payload.ajudouPedidos = this.ajudouPedidos();
      if (this.mostrarPreco()) payload.precoAdequado = this.precoAdequado();
      if (this.mostrarFuncionalidade()) {
        payload.funcionalidadeFaltante = texto(this.funcionalidadeFaltante());
      }
      payload.paraContinuar = texto(this.paraContinuar());
    } else {
      payload.experiencia = texto(this.experiencia());
    }
    if (this.satisfacao() !== '') payload.satisfacao = Number(this.satisfacao());
    if (this.voltaria() !== '') payload.voltaria = this.voltaria();
    payload.contatoLiberado = this.ehLanchonete() && this.contatoLiberado();
    if (payload.contatoLiberado) payload.contato = texto(this.contato());
    return payload;
  }

  private valida(): boolean {
    const erros: Record<string, string> = {};
    if (this.motivo() === '') erros['motivo'] = 'Escolha um motivo para continuar.';
    if (this.ehLanchonete()) {
      if (this.secundarios().length === 0) {
        erros['secundarios'] = 'Escolha ao menos um item.';
      }
      if (this.mostrarPreco() && this.precoAdequado() === '') {
        erros['preco'] = 'Escolha uma faixa de preço.';
      }
      if (this.ajudouPedidos() === '') {
        erros['ajudou'] = 'Escolha uma das opções.';
      }
    } else if (this.satisfacao() === '') {
      erros['satisfacao'] = 'Escolha uma nota para continuar.';
    }
    this.erros.set(erros);
    return Object.keys(erros).length === 0;
  }

  private limparErro(campo: string): void {
    const atuais = this.erros();
    if (!atuais[campo]) return;
    const copia = { ...atuais };
    delete copia[campo];
    this.erros.set(copia);
  }

  /** Sugere o WhatsApp/e-mail que a loja já cadastrou (só conveniência, nunca obrigatório). */
  private async sugerirContato(): Promise<void> {
    const slug = this.slug();
    if (!slug) return;
    try {
      const config = await firstValueFrom(
        this.api.get<{ emailContato?: string | null; whatsapp?: string | null }>(
          `/admin/lanchonetes/${slug}`,
        ),
      );
      this.contatoSugerido.set(config.emailContato || config.whatsapp || '');
    } catch {
      // Sem sugestão é o normal (a pergunta é opcional).
    }
  }

  private mensagemDeErro(erro: unknown): string {
    const mensagem = (erro as { error?: { message?: string } }).error?.message;
    if (mensagem) return mensagem;
    return 'Não foi possível encerrar agora. Tente novamente em instantes.';
  }

  private agendarSaida(destino: string): void {
    this.timer = setTimeout(() => {
      void this.router.navigate([destino]);
    }, SAIR_EM_MS);
  }
}
