import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  labelStatus as rotularStatus,
  STATUS_COM_PIX,
  tipoEntregaLabel as rotularTipo,
  type PedidoStatus,
} from '../../services/pedido-painel';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { firstValueFrom } from 'rxjs';

interface PedidoItem {
  id: string;
  produtoId: string | null;
  nome: string;
  precoUnit: number;
  qtd: number;
  opcoes: {
    id: string;
    opcaoId: string | null;
    nome: string;
    precoAdicional: number;
    remove: boolean;
  }[];
}

interface Pedido {
  id: string;
  numero: number;
  status: string;
  tipoEntrega: string;
  justificativaCancelamento: string | null;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  formaPagamento: string;
  brCodePix: string | null;
  pixConfirmado: boolean;
  pixConfirmadoEm: string | null;
  enderecoEntrega: {
    rua: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string | null;
  } | null;
  observacao: string | null;
  pagamentoInfo: string | null;
  lanchonete: { nome: string; slug: string; logoUrl: string | null };
  createdAt: string;
  itens: PedidoItem[];
}

@Component({
  selector: 'app-meus-pedidos',
  imports: [CurrencyPipe, DatePipe, RouterLink, Button, Textarea],
  templateUrl: './meus-pedidos.component.html',
  styleUrl: './meus-pedidos.component.scss',
})
export class MeusPedidosComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  /** Reavalia a lista a cada 20s: o QR some sozinho quando a lanchonete confirma. */
  private readonly RELOAD_MS = 20000;
  private timerRef: ReturnType<typeof setInterval> | null = null;

  readonly pedidos = signal<Pedido[]>([]);
  readonly historico = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly qrUrls = signal<Record<string, string>>({});

  labelStatus(status: string): string {
    return rotularStatus(status);
  }

  labelTipo(tipo: string): string {
    return rotularTipo(tipo);
  }

  rotuloPagamento(forma: string): string {
    switch (forma) {
      case 'cartao':
        return 'Cartão';
      case 'dinheiro':
        return 'Dinheiro';
      default:
        return 'PIX';
    }
  }

  /** QR Code some quando a lanchonete confirma o recebimento do pagamento. */
  mostraPix(pedido: Pedido): boolean {
    return (
      pedido.formaPagamento === 'pix' &&
      !!pedido.brCodePix &&
      !pedido.pixConfirmado &&
      STATUS_COM_PIX.has(pedido.status as PedidoStatus)
    );
  }

  /** Pedido PIX já confirmado pela lanchonete (aviso, sem QR). */
  pixConfirmado(pedido: Pedido): boolean {
    return pedido.formaPagamento === 'pix' && pedido.pixConfirmado;
  }

  ngOnInit(): void {
    void this.carregar();
    this.timerRef = setInterval(() => {
      void this.recarregarSilencioso();
    }, this.RELOAD_MS);
  }

  ngOnDestroy(): void {
    if (this.timerRef) clearInterval(this.timerRef);
  }

  /** Botão "Atualizar" — recarrega a lista sem apagar a tela. */
  atualizar(): void {
    void this.recarregarSilencioso();
  }

  private async carregar(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    await this.auth.init();
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth'], {
        queryParams: { redirect: '/meus-pedidos' },
      });
      return;
    }
    try {
      const pedidos = await this.buscarPedidos();
      this.pedidos.set(pedidos);
      await this.gerarQrs(pedidos);
    } catch {
      this.error.set('Não foi possível carregar seus pedidos.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Reconsulta a lista em segundo plano (timer + botão Atualizar). */
  private async recarregarSilencioso(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      const pedidos = await this.buscarPedidos();
      this.pedidos.set(pedidos);
      await this.gerarQrs(pedidos);
    } catch {
      // Sem sessão ou rede — mantém a tela como está.
    }
  }

  private buscarPedidos(): Promise<Pedido[]> {
    return firstValueFrom(
      this.api.get<Pedido[]>(`/me/pedidos${this.historico() ? '?historico=1' : ''}`),
    );
  }

  alternarHistorico(): void {
    this.historico.update((v) => !v);
    void this.carregar();
  }

  private async gerarQrs(pedidos: Pedido[]): Promise<void> {
    const mapa = { ...this.qrUrls() };
    let mudou = false;
    for (const p of pedidos) {
      if (p.brCodePix && this.mostraPix(p) && !mapa[p.id]) {
        try {
          mapa[p.id] = await QRCode.toDataURL(p.brCodePix, { width: 220, margin: 1 });
          mudou = true;
        } catch {
          // QR indisponível; segue sem ele
        }
      }
    }
    // Libera o QR de pedidos que saíram do estado "aguardando pagamento".
    const visiveis = new Set(pedidos.filter((p) => this.mostraPix(p)).map((p) => p.id));
    for (const id of Object.keys(mapa)) {
      if (!visiveis.has(id)) {
        delete mapa[id];
        mudou = true;
      }
    }
    if (mudou) this.qrUrls.set(mapa);
  }

  podeRepetir(pedido: Pedido): boolean {
    return pedido.itens.every((item) => !!item.produtoId);
  }

  async repetirPedido(pedido: Pedido): Promise<void> {
    this.cart.carregar(pedido.lanchonete.slug);
    this.cart.limpar();
    for (const item of pedido.itens) {
      if (!item.produtoId) continue;
      const extras = item.opcoes
        .filter((o) => !o.remove)
        .reduce((acc, o) => acc + o.precoAdicional, 0);
      const precoBase = Math.max(0, Math.round((item.precoUnit - extras) * 100) / 100);
      this.cart.adicionar({
        produtoId: item.produtoId,
        nome: item.nome,
        preco: precoBase,
        qtd: item.qtd,
        opcoes: item.opcoes.map((o) => ({
          opcaoId: o.opcaoId ?? '',
          nome: o.nome,
          precoAdicional: o.precoAdicional,
          remove: o.remove,
        })),
      });
    }
    await this.router.navigate(['/', pedido.lanchonete.slug]);
  }

  async copiarPix(pedido: Pedido): Promise<void> {
    if (!pedido.brCodePix) return;
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
}
