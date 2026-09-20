import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  labelStatus as rotularStatus,
  STATUS_COM_PIX,
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
  justificativaCancelamento: string | null;
  subtotal: number;
  total: number;
  formaPagamento: string;
  brCodePix: string | null;
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
export class MeusPedidosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly pedidos = signal<Pedido[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly qrUrls = signal<Record<string, string>>({});

  labelStatus(status: string): string {
    return rotularStatus(status);
  }

  mostraPix(pedido: Pedido): boolean {
    return !!pedido.brCodePix && STATUS_COM_PIX.has(pedido.status as PedidoStatus);
  }

  ngOnInit(): void {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    await this.auth.init();
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth'], {
        queryParams: { redirect: '/minhas-pedidos' },
      });
      return;
    }
    try {
      const pedidos = await firstValueFrom(this.api.get<Pedido[]>('/me/pedidos'));
      this.pedidos.set(pedidos);
      await this.gerarQrs(pedidos);
    } catch {
      this.error.set('Não foi possível carregar seus pedidos.');
    } finally {
      this.loading.set(false);
    }
  }

  private async gerarQrs(pedidos: Pedido[]): Promise<void> {
    const mapa = { ...this.qrUrls() };
    for (const p of pedidos) {
      if (p.brCodePix && this.mostraPix(p) && !mapa[p.id]) {
        try {
          mapa[p.id] = await QRCode.toDataURL(p.brCodePix, { width: 220, margin: 1 });
        } catch {
          // QR indisponível; segue sem ele
        }
      }
    }
    this.qrUrls.set(mapa);
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
