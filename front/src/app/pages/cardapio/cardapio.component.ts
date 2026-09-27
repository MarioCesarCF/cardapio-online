import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MarcaService } from '../../services/marca.service';
import { PerfilService } from '../../services/perfil.service';
import { CartService, type CartItem } from '../../services/cart.service';
import { formatarMoeda } from '../../services/moeda';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import { dentroDoHorario, horarioResumo, type HorarioDia } from '../../services/horarios';
import {
  labelStatus,
  STATUS_COM_PIX,
  tipoEntregaCurto,
  tipoEntregaLabel,
  type PedidoStatus,
} from '../../services/pedido-painel';

/**
 * Os overlays do cardápio usam `appendTo="self"` (sem `p-overlay` no body) para
 * herdar a cor da lanchonete, que fica restrita à subárvore da página. Nesse modo
 * o PrimeNG não gerencia z-index, então o app bar fixo (`position: sticky`,
 * z-index 900) cobria o topo dos painéis — no drawer isso escondia o botão de
 * fechar. Por isso todos recebem um z-index próprio acima do app bar.
 */
const Z_OVERLAY = 1000;

/**
 * Abertura do modal de checkout: entra a tela travada e só sai com o modal no
 * ar (ou com erro). O watchdog abaixo é a rede de segurança — se a sessão ou o
 * `GET /me` ficarem pendurados (rede travada), a tela é liberada com aviso em
 * vez de deixar o cliente preso num loading eterno.
 */
const TEMPO_MAXIMO_CHECKOUT = 15000;

interface Lanchonete {
  id: string;
  nome: string;
  logoUrl: string | null;
  fonte: string | null;
  corPrincipal: string | null;
  tipo: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  enderecoLoja: string | null;
  horarios: HorarioDia[] | null;
  cobraTaxaEntrega: boolean;
  taxaEntrega: number;
  aceitaPix: boolean;
}

interface Opcao {
  id: string;
  nome: string;
  precoAdicional: number;
  remove: boolean;
}

interface GrupoOpcoes {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
  opcoes: Opcao[];
}

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  destaque: boolean;
  imagemUrl: string | null;
  grupos: GrupoOpcoes[];
}

interface Categoria {
  id: string;
  nome: string;
  produtos: Produto[];
}

interface CardapioResponse {
  lanchonete: Lanchonete;
  categorias: Categoria[];
}

interface Endereco {
  id: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string | null;
  apelido: string | null;
  padrao: boolean;
}

interface PedidoConfirmado {
  id: string;
  numero: number;
  status: string;
  tipoEntrega: string;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  formaPagamento: string;
  brCodePix: string;
  pixConfirmado: boolean;
}

@Component({
  selector: 'app-cardapio',
  imports: [
    CurrencyPipe,
    RouterLink,
    HeaderLanchoneteComponent,
    Button,
    Dialog,
    Drawer,
    InputText,
    Textarea,
  ],
  templateUrl: './cardapio.component.html',
  styleUrl: './cardapio.component.scss',
})
export class CardapioComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly perfil = inject(PerfilService);
  private readonly marca = inject(MarcaService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly msg = inject(MessageService);
  readonly cart = inject(CartService);

  private timerRef: ReturnType<typeof setInterval> | null = null;
  private timerCheckout: ReturnType<typeof setTimeout> | null = null;
  /** Gera a tentativa corrente: descarta o retorno de um clique antigo/travado. */
  private checkoutTentativa = 0;

  readonly rotuloStatus = labelStatus;
  readonly rotuloTipo = tipoEntregaLabel;
  readonly tipoCurto = tipoEntregaCurto;
  readonly zOverlay = Z_OVERLAY;

  readonly config = signal<Lanchonete | null>(null);
  readonly cardapio = signal<CardapioResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rotaPerfil = computed(() => {
    const principal = this.perfil.perfilPrincipal();
    if (principal === 'admin-sistema') {
      return { rotulo: 'Painel da plataforma', rota: '/painel-admin' };
    }
    if (principal === 'dono') {
      return { rotulo: 'Painel do dono', rota: '/admin' };
    }
    if (principal === 'cliente') {
      return { rotulo: 'Página principal', rota: '/home' };
    }
    return null;
  });

  readonly theme = computed(() => {
    const c = this.config();
    return {
      '--cardapio-cor': c?.corPrincipal ?? 'var(--p-primary-color)',
      '--cardapio-fonte': c?.fonte ? c.fonte : 'inherit',
    };
  });

  readonly resumoHorarios = computed(() => horarioResumo(this.config()?.horarios));

  estaAberta(): boolean {
    return dentroDoHorario(this.config()?.horarios ?? null, new Date());
  }

  resumoInfo(lanchonete: Lanchonete): string {
    return [
      lanchonete.enderecoLoja,
      lanchonete.whatsapp ? `WhatsApp: ${lanchonete.whatsapp}` : null,
      lanchonete.emailContato,
    ]
      .filter((parte): parte is string => Boolean(parte))
      .join(' · ');
  }

  readonly modalProduto = signal<Produto | null>(null);
  readonly escolhas = signal<Map<string, string[]>>(new Map());
  readonly erroModal = signal<string | null>(null);

  readonly cartAberto = signal(false);
  readonly checkoutAberto = signal(false);
  /** Tela travada entre o clique em "Finalizar pedido" e a abertura do modal. */
  readonly abrindoCheckout = signal(false);
  readonly pedido = signal<PedidoConfirmado | null>(null);
  readonly pedidoPainelAberto = signal(false);
  readonly qrUrl = signal<string | null>(null);
  readonly formaPedido = signal<'pix' | 'cartao' | 'dinheiro' | null>(null);

  /** Barra fixa da sacola: some com a sacola vazia, com o drawer aberto e durante o checkout. */
  readonly mostrarBarraSacola = computed(
    () =>
      this.cart.totalItens() > 0 &&
      !this.cartAberto() &&
      !this.checkoutAberto() &&
      !this.abrindoCheckout() &&
      !this.pedidoPainelAberto(),
  );

  readonly enderecos = signal<Endereco[]>([]);
  readonly enderecoSelecionadoId = signal<string | null>(null);
  readonly usarNovo = signal(false);
  readonly salvarNovo = signal(false);
  readonly novoEndereco = signal<Record<string, string>>({});
  readonly observacao = signal('');
  readonly formaPagamento = signal<'pix' | 'cartao' | 'dinheiro'>('pix');
  readonly tipoPedido = signal<'entrega' | 'retirar' | 'consumir'>('entrega');
  readonly precisaTroco = signal(false);
  readonly trocoPara = signal('');
  readonly semTelefone = signal(false);
  readonly telefone = signal('');
  readonly telefoneSalvo = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly erroPedido = signal<string | null>(null);

  /**
   * A lanchonete sem chave PIX não consegue gerar BR Code (o back responde 400),
   * então o checkout oferece Cartão/Dinheiro. `?? true` mantém o comportamento
   * atual se o campo vier ausente de um back antigo.
   */
  readonly aceitaPix = computed(() => this.config()?.aceitaPix ?? true);

  private slug = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.slug = slug;
      this.checkoutTentativa++;
      this.fecharTelaTravada();
      this.pedido.set(null);
      this.qrUrl.set(null);
      this.pedidoPainelAberto.set(false);
      this.formaPedido.set(null);
      this.cart.carregar(slug);
      this.load(slug);
    });
    this.timerRef = setInterval(() => this.refreshPedidoStatus(), 20000);
    if (this.auth.isAuthenticated()) {
      void this.perfil.carregar(true);
    }
  }

  ngOnDestroy(): void {
    if (this.timerRef) clearInterval(this.timerRef);
    this.desarmarWatchdog();
    this.travandoTela(false);
  }

  private load(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.config.set(null);
    this.cardapio.set(null);

    this.api.get<Lanchonete>(`/l/${slug}/config`).subscribe({
      next: (config) => {
        this.config.set(config);
        this.marca.aplicar(config.corPrincipal, this.host.nativeElement);
        this.loadCardapio(slug);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Cardápio não encontrado.');
      },
    });
  }

  private loadCardapio(slug: string): void {
    this.api.get<CardapioResponse>(`/l/${slug}/cardapio`).subscribe({
      next: (cardapio) => {
        this.cardapio.set(cardapio);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Não foi possível carregar o cardápio.');
      },
    });
  }

  abrirProduto(produto: Produto): void {
    this.modalProduto.set(produto);
    this.escolhas.update(
      () => new Map(produto.grupos.map((g) => [g.id, []] as [string, string[]])),
    );
    this.erroModal.set(null);
  }

  fecharProduto(): void {
    this.modalProduto.set(null);
  }

  toggleOpcao(grupo: GrupoOpcoes, opcao: Opcao): void {
    this.erroModal.set(null);
    this.escolhas.update((atual) => {
      const mapa = new Map(atual);
      const selecionadas = mapa.get(grupo.id) ?? [];
      if (grupo.tipo === 'unica') {
        mapa.set(grupo.id, [opcao.id]);
      } else if (selecionadas.includes(opcao.id)) {
        mapa.set(
          grupo.id,
          selecionadas.filter((id) => id !== opcao.id),
        );
      } else {
        if (grupo.maxSelecoes != null && selecionadas.length >= grupo.maxSelecoes) {
          this.erroModal.set(`Máximo de ${grupo.maxSelecoes} seleção(ões) em "${grupo.nome}".`);
          return mapa;
        }
        mapa.set(grupo.id, [...selecionadas, opcao.id]);
      }
      return mapa;
    });
  }

  estaSelecionada(grupo: GrupoOpcoes, opcao: Opcao): boolean {
    return (this.escolhas().get(grupo.id) ?? []).includes(opcao.id);
  }

  confirmarAdicionar(): void {
    const produto = this.modalProduto();
    if (!produto) return;

    const erros: string[] = [];
    for (const grupo of produto.grupos) {
      const selecionadas = this.escolhas().get(grupo.id) ?? [];
      const temRemover = selecionadas.some((id) =>
        grupo.opcoes.some((o) => o.id === id && o.remove),
      );
      const minimo = grupo.obrigatorio ? Math.max(grupo.minSelecoes, 1) : grupo.minSelecoes;
      if (grupo.tipo === 'unica' && selecionadas.length > 1) {
        erros.push(`"${grupo.nome}": escolha apenas 1 opção.`);
      }
      if (selecionadas.length < minimo) {
        erros.push(`"${grupo.nome}" é obrigatório (mínimo ${minimo}).`);
      }
      if (grupo.maxSelecoes != null && selecionadas.length > grupo.maxSelecoes) {
        erros.push(`"${grupo.nome}": máximo de ${grupo.maxSelecoes}.`);
      }
      if (temRemover && selecionadas.length > 1) {
        erros.push(`"${grupo.nome}": a opção "remover" não combina com acréscimos.`);
      }
    }

    if (erros.length > 0) {
      this.erroModal.set(erros.join(' '));
      return;
    }

    const opcoes = [];
    for (const grupo of produto.grupos) {
      for (const id of this.escolhas().get(grupo.id) ?? []) {
        const opcao = grupo.opcoes.find((o) => o.id === id);
        if (opcao) {
          opcoes.push({
            opcaoId: opcao.id,
            nome: opcao.nome,
            precoAdicional: opcao.precoAdicional,
            remove: opcao.remove,
          });
        }
      }
    }

    this.cart.adicionar({
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      opcoes,
    });
    this.fecharProduto();
    this.msg.add({
      severity: 'success',
      summary: 'Adicionado à sacola',
      detail: produto.nome,
      life: 2500,
    });
  }

  setQtd(item: CartItem, qtd: number): void {
    this.cart.setQtd(item.chave, qtd);
  }

  /** Fecha o drawer da sacola (botão X do topo e "Continuar escolhendo" do rodapé). */
  fecharSacola(): void {
    this.cartAberto.set(false);
  }

  async irFinalizar(): Promise<void> {
    if (this.abrindoCheckout()) return;
    const tentativa = ++this.checkoutTentativa;

    this.abrindoCheckout.set(true);
    this.travandoTela(true);
    this.armarWatchdog(tentativa);

    try {
      await this.auth.init();
      if (tentativa !== this.checkoutTentativa) return;
      if (!this.auth.isAuthenticated()) {
        await this.router.navigate(['/auth'], { queryParams: { redirect: `/${this.slug}` } });
        return;
      }
      this.cartAberto.set(false);
      await this.abrirCheckout(tentativa);
    } catch {
      if (tentativa !== this.checkoutTentativa) return;
      this.msg.add({
        severity: 'error',
        summary: 'Não foi possível abrir o pedido',
        detail: 'Tente novamente em instantes.',
        life: 5000,
      });
    } finally {
      if (tentativa === this.checkoutTentativa) this.fecharTelaTravada();
    }
  }

  /**
   * Rede de segurança: se sessão/`GET /me` não responderem em
   * {@link TEMPO_MAXIMO_CHECKOUT}, libera a tela com aviso e invalida a tentativa
   * pendente (senão ela abriria o modal por cima de um clique novo do cliente).
   */
  private armarWatchdog(tentativa: number): void {
    this.desarmarWatchdog();
    this.timerCheckout = setTimeout(() => {
      this.timerCheckout = null;
      if (tentativa !== this.checkoutTentativa || !this.abrindoCheckout()) return;
      this.checkoutTentativa++;
      this.fecharTelaTravada();
      this.msg.add({
        severity: 'warn',
        summary: 'Isso demorou mais que o esperado',
        detail: 'Não foi possível abrir o pedido. Tente novamente.',
        life: 5000,
      });
    }, TEMPO_MAXIMO_CHECKOUT);
  }

  private desarmarWatchdog(): void {
    if (this.timerCheckout) {
      clearTimeout(this.timerCheckout);
      this.timerCheckout = null;
    }
  }

  private fecharTelaTravada(): void {
    this.desarmarWatchdog();
    this.abrindoCheckout.set(false);
    this.travandoTela(false);
  }

  /** Trava a rolagem do fundo enquanto a tela travada está no ar. */
  private travandoTela(ativo: boolean): void {
    document.body.classList.toggle('tela-travada', ativo);
  }

  private async abrirCheckout(tentativa: number): Promise<void> {
    this.erroPedido.set(null);
    this.observacao.set('');
    this.formaPagamento.set(this.aceitaPix() ? 'pix' : 'dinheiro');
    this.tipoPedido.set('entrega');
    this.precisaTroco.set(false);
    this.trocoPara.set('');
    this.usarNovo.set(false);
    this.novoEndereco.set({});
    try {
      const me = await firstValueFrom(
        this.api.get<{ enderecos: Endereco[]; cliente: { telefone?: string | null } | null }>(
          '/me',
        ),
      );
      if (tentativa !== this.checkoutTentativa) return;
      this.enderecos.set(me.enderecos);
      const padrao = me.enderecos.find((e) => e.padrao) ?? me.enderecos[0] ?? null;
      this.enderecoSelecionadoId.set(padrao?.id ?? null);
      this.telefoneSalvo.set(me.cliente?.telefone?.replace(/\D/g, '') ?? null);
      this.semTelefone.set(!this.telefoneSalvo());
      this.telefone.set('');
    } catch {
      if (tentativa !== this.checkoutTentativa) return;
      this.enderecos.set([]);
      this.enderecoSelecionadoId.set(null);
      this.usarNovo.set(true);
    }
    if (tentativa !== this.checkoutTentativa) return;
    this.checkoutAberto.set(true);
  }

  setCampo(nome: string, valor: string): void {
    this.novoEndereco.update((form) => ({ ...form, [nome]: valor }));
  }

  selecionarEndereco(id: string): void {
    this.enderecoSelecionadoId.set(id);
  }

  fecharCheckout(): void {
    if (this.enviando()) return;
    this.checkoutAberto.set(false);
  }

  definirFormaPagamento(forma: 'pix' | 'cartao' | 'dinheiro', marcado: boolean): void {
    if (forma === 'pix' && !this.aceitaPix()) return;
    if (marcado) {
      this.formaPagamento.set(forma);
      if (forma !== 'dinheiro') {
        this.precisaTroco.set(false);
        this.trocoPara.set('');
      }
    }
  }

  definirTipoPedido(tipo: 'entrega' | 'retirar' | 'consumir', marcado: boolean): void {
    if (marcado) {
      this.tipoPedido.set(tipo);
      this.erroPedido.set(null);
    }
  }

  mostrarEndereco(): boolean {
    return this.tipoPedido() === 'entrega';
  }

  readonly taxaEntrega = computed(() => {
    if (this.tipoPedido() !== 'entrega') return 0;
    const l = this.config();
    return l?.cobraTaxaEntrega ? (l.taxaEntrega ?? 0) : 0;
  });

  readonly totalComTaxa = computed(
    () => Math.round((this.cart.total() + this.taxaEntrega()) * 100) / 100,
  );

  avisoPagamento(): string | null {
    if (this.formaPagamento() === 'pix') return null;
    if (this.mostrarEndereco()) return 'Pagamento será realizado no momento da entrega.';
    return this.tipoPedido() === 'retirar'
      ? 'Pagamento será realizado no momento da retirada.'
      : 'Pagamento será realizado no local.';
  }

  private pagamentoInfoMontada(): string {
    switch (this.formaPagamento()) {
      case 'cartao':
        return 'Forma de pagamento: Cartão de crédito/débito';
      case 'dinheiro':
        return this.precisaTroco()
          ? `Forma de pagamento: Dinheiro (troco para ${formatarMoeda(Number(this.trocoPara().replace(',', '.')))})`
          : 'Forma de pagamento: Dinheiro';
      default:
        return 'Forma de pagamento: Pix';
    }
  }

  async confirmarPedido(): Promise<void> {
    this.erroPedido.set(null);
    if (this.enviando()) return;

    if (!this.estaAberta()) {
      this.erroPedido.set('A lanchonete está fora do horário de funcionamento no momento.');
      return;
    }

    const itens = this.cart.linhas().map((item) => ({
      produtoId: item.produtoId,
      qtd: item.qtd,
      opcoes: item.opcoes.map((o) => ({ opcaoId: o.opcaoId })),
    }));
    if (itens.length === 0) {
      this.erroPedido.set('Sua sacola está vazia.');
      return;
    }

    if (this.semTelefone()) {
      const digitos = this.telefone().replace(/\D/g, '');
      if (!/^\d{10,13}$/.test(digitos)) {
        this.erroPedido.set('Informe seu WhatsApp com DDD (ex.: 11999999999).');
        return;
      }
    }

    if (this.formaPagamento() === 'dinheiro' && this.precisaTroco()) {
      const valor = Number(this.trocoPara().replace(',', '.'));
      if (!this.trocoPara().trim() || !Number.isFinite(valor) || valor <= 0) {
        this.erroPedido.set('Informe para quanto precisa de troco (ex.: 50,00).');
        return;
      }
    }

    let enderecoId: string | null = null;
    let endereco: Record<string, string | undefined> | null = null;

    if (this.mostrarEndereco()) {
      if (this.usarNovo()) {
        const form = this.novoEndereco();
        if (
          !form['rua']?.trim() ||
          !form['numero']?.trim() ||
          !form['bairro']?.trim() ||
          !form['cidade']?.trim() ||
          !form['uf']?.trim()
        ) {
          this.erroPedido.set('Preencha os campos obrigatórios do endereço.');
          return;
        }
        const dados = {
          rua: form['rua'].trim(),
          numero: form['numero'].trim(),
          complemento: form['complemento']?.trim() || undefined,
          bairro: form['bairro'].trim(),
          cidade: form['cidade'].trim(),
          uf: form['uf'].trim().toUpperCase(),
          cep: form['cep']?.trim() || undefined,
          apelido: form['apelido']?.trim() || undefined,
        };
        if (this.salvarNovo()) {
          const criado = await firstValueFrom(this.api.post<Endereco>('/me/enderecos', dados));
          enderecoId = criado.id;
        } else {
          endereco = dados;
        }
      } else {
        enderecoId = this.enderecoSelecionadoId();
        if (!enderecoId) {
          this.erroPedido.set('Escolha um endereço de entrega (ou cadastre um novo).');
          return;
        }
      }
    }

    this.enviando.set(true);
    try {
      const pedido = await firstValueFrom(
        this.api.post<PedidoConfirmado>(`/l/${this.slug}/pedidos`, {
          itens,
          ...(enderecoId ? { enderecoId } : { endereco }),
          observacao: this.observacao().trim() || undefined,
          pagamentoInfo: this.pagamentoInfoMontada(),
          formaPagamento: this.formaPagamento(),
          tipoEntrega: this.tipoPedido(),
          telefone: this.telefone().replace(/\D/g, '') || this.telefoneSalvo() || undefined,
        }),
      );
      if (this.telefone().replace(/\D/g, '')) {
        this.semTelefone.set(false);
      }
      this.pedido.set(pedido);
      this.formaPedido.set(this.formaPagamento());
      this.qrUrl.set(null);
      if (this.formaPagamento() === 'pix' && pedido.brCodePix) {
        try {
          this.qrUrl.set(await QRCode.toDataURL(pedido.brCodePix, { width: 240, margin: 1 }));
        } catch {
          this.qrUrl.set(null);
        }
      }
      this.pedidoPainelAberto.set(true);
      this.checkoutAberto.set(false);
      this.cart.limpar();
    } catch (error) {
      const apiError = error as { error?: { message?: string } };
      this.erroPedido.set(apiError.error?.message ?? 'Não foi possível confirmar o pedido.');
    } finally {
      this.enviando.set(false);
    }
  }

  async copiarPix(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido?.brCodePix) return;
    try {
      await navigator.clipboard.writeText(pedido.brCodePix);
    } catch {
      const area = document.createElement('textarea');
      area.value = pedido.brCodePix;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  fecharPedido(): void {
    this.pedidoPainelAberto.set(false);
  }

  precisaPagar(status: string): boolean {
    return (
      STATUS_COM_PIX.has(status as PedidoStatus) &&
      this.formaPedido() === 'pix' &&
      !this.pixConfirmado()
    );
  }

  /** A lanchonete já confirmou o recebimento: o QR some para o cliente. */
  pixConfirmado(): boolean {
    return this.pedido()?.pixConfirmado === true;
  }

  pagamentoRotulo(): string {
    switch (this.formaPedido()) {
      case 'cartao':
        return 'Cartão de crédito/débito';
      case 'dinheiro':
        return 'Dinheiro';
      default:
        return 'Pix';
    }
  }

  async reabrirPedido(): Promise<void> {
    if (!this.pedido()) return;
    await this.refreshPedidoStatus();
    this.pedidoPainelAberto.set(true);
  }

  private async refreshPedidoStatus(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido) return;
    try {
      const pedidos = await firstValueFrom(
        this.api.get<{ id: string; status: string; pixConfirmado: boolean }[]>('/me/pedidos'),
      );
      const atual = pedidos.find((p) => p.id === pedido.id);
      if (!atual) return;
      if (
        atual.status !== pedido.status ||
        Boolean(atual.pixConfirmado) !== Boolean(pedido.pixConfirmado)
      ) {
        this.pedido.update((p) =>
          p ? { ...p, status: atual.status, pixConfirmado: Boolean(atual.pixConfirmado) } : p,
        );
        if (atual.pixConfirmado) this.qrUrl.set(null);
      }
    } catch {
      // Sem sessão ou rede — mantém o status atual.
    }
  }
}
