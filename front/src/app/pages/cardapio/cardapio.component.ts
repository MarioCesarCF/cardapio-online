import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MarcaService } from '../../services/marca.service';
import { CartService, type CartItem } from '../../services/cart.service';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import { labelStatus, STATUS_COM_PIX, type PedidoStatus } from '../../services/pedido-painel';

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
  total: number;
  brCodePix: string;
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
  private readonly marca = inject(MarcaService);
  readonly cart = inject(CartService);

  private timerRef: ReturnType<typeof setInterval> | null = null;

  readonly rotuloStatus = labelStatus;

  readonly config = signal<Lanchonete | null>(null);
  readonly cardapio = signal<CardapioResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly logado = computed(() => this.auth.isAuthenticated());

  readonly theme = computed(() => {
    const c = this.config();
    return {
      '--cardapio-cor': c?.corPrincipal ?? 'var(--p-primary-color)',
      '--cardapio-fonte': c?.fonte ? c.fonte : 'inherit',
    };
  });

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
  readonly pedido = signal<PedidoConfirmado | null>(null);
  readonly pedidoPainelAberto = signal(false);
  readonly qrUrl = signal<string | null>(null);

  readonly enderecos = signal<Endereco[]>([]);
  readonly enderecoSelecionadoId = signal<string | null>(null);
  readonly usarNovo = signal(false);
  readonly salvarNovo = signal(false);
  readonly novoEndereco = signal<Record<string, string>>({});
  readonly observacao = signal('');
  readonly semTelefone = signal(false);
  readonly telefone = signal('');
  readonly telefoneSalvo = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly erroPedido = signal<string | null>(null);

  private slug = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.slug = slug;
      this.pedido.set(null);
      this.qrUrl.set(null);
      this.pedidoPainelAberto.set(false);
      this.cart.carregar(slug);
      this.load(slug);
    });
    this.timerRef = setInterval(() => this.refreshPedidoStatus(), 20000);
  }

  ngOnDestroy(): void {
    if (this.timerRef) clearInterval(this.timerRef);
  }

  private load(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.config.set(null);
    this.cardapio.set(null);

    this.api.get<Lanchonete>(`/l/${slug}/config`).subscribe({
      next: (config) => {
        this.config.set(config);
        this.marca.aplicar(config.corPrincipal);
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
    this.cartAberto.set(true);
  }

  setQtd(item: CartItem, qtd: number): void {
    this.cart.setQtd(item.chave, qtd);
  }

  async irFinalizar(): Promise<void> {
    await this.auth.init();
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth'], { queryParams: { redirect: `/${this.slug}` } });
      return;
    }
    this.cartAberto.set(false);
    await this.abrirCheckout();
  }

  private async abrirCheckout(): Promise<void> {
    this.erroPedido.set(null);
    this.observacao.set('');
    this.usarNovo.set(false);
    this.novoEndereco.set({});
    try {
      const me = await firstValueFrom(
        this.api.get<{ enderecos: Endereco[]; cliente: { telefone?: string | null } | null }>(
          '/me',
        ),
      );
      this.enderecos.set(me.enderecos);
      const padrao = me.enderecos.find((e) => e.padrao) ?? me.enderecos[0] ?? null;
      this.enderecoSelecionadoId.set(padrao?.id ?? null);
      this.telefoneSalvo.set(me.cliente?.telefone?.replace(/\D/g, '') ?? null);
      this.semTelefone.set(!this.telefoneSalvo());
      this.telefone.set('');
    } catch {
      this.enderecos.set([]);
      this.enderecoSelecionadoId.set(null);
      this.usarNovo.set(true);
    }
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

  async confirmarPedido(): Promise<void> {
    this.erroPedido.set(null);
    if (this.enviando()) return;

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

    let enderecoId: string | null = null;
    let endereco: Record<string, string | undefined> | null = null;

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

    this.enviando.set(true);
    try {
      const pedido = await firstValueFrom(
        this.api.post<PedidoConfirmado>(`/l/${this.slug}/pedidos`, {
          itens,
          ...(enderecoId ? { enderecoId } : { endereco }),
          observacao: this.observacao().trim() || undefined,
          telefone: this.telefone().replace(/\D/g, '') || this.telefoneSalvo() || undefined,
        }),
      );
      if (this.telefone().replace(/\D/g, '')) {
        this.semTelefone.set(false);
      }
      this.pedido.set(pedido);
      this.qrUrl.set(null);
      try {
        this.qrUrl.set(await QRCode.toDataURL(pedido.brCodePix, { width: 240, margin: 1 }));
      } catch {
        this.qrUrl.set(null);
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
    return STATUS_COM_PIX.has(status as PedidoStatus);
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
        this.api.get<{ id: string; status: string }[]>('/me/pedidos'),
      );
      const atual = pedidos.find((p) => p.id === pedido.id);
      if (atual && atual.status !== pedido.status) {
        this.pedido.update((p) => (p ? { ...p, status: atual.status } : p));
      }
    } catch {
      // Sem sessão ou rede — mantém o status atual.
    }
  }
}
