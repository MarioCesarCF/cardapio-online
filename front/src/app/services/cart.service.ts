import { computed, Injectable, signal } from '@angular/core';

export interface CartOpcao {
  opcaoId: string;
  nome: string;
  precoAdicional: number;
  remove: boolean;
}

export interface CartItem {
  chave: string;
  produtoId: string;
  nome: string;
  preco: number;
  qtd: number;
  opcoes: CartOpcao[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itens = signal<CartItem[]>([]);
  readonly linhas = this.itens.asReadonly();
  readonly totalItens = computed(() => this.itens().reduce((acc, item) => acc + item.qtd, 0));
  readonly total = computed(() =>
    this.itens().reduce((acc, item) => acc + this.precoUnit(item) * item.qtd, 0),
  );

  private slugAtual: string | null = null;

  carregar(slug: string): void {
    if (this.slugAtual === slug) return;
    this.slugAtual = slug;
    try {
      const raw = localStorage.getItem(`cart.${slug}`);
      this.itens.set(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      this.itens.set([]);
    }
  }

  adicionar(item: Omit<CartItem, 'chave' | 'qtd'> & { qtd?: number }): void {
    const chave = chaveItem(item);
    const atuais = this.itens();
    const idx = atuais.findIndex((i) => i.chave === chave);
    if (idx >= 0) {
      const copia = [...atuais];
      copia[idx] = { ...copia[idx], qtd: copia[idx].qtd + (item.qtd ?? 1) };
      this.itens.set(copia);
    } else {
      this.itens.set([...atuais, { ...item, chave, qtd: item.qtd ?? 1 }]);
    }
    this.persistir();
  }

  setQtd(chave: string, qtd: number): void {
    this.itens.update((novos) =>
      novos.map((i) => (i.chave === chave ? { ...i, qtd: Math.max(1, qtd) } : i)),
    );
    this.persistir();
  }

  remover(chave: string): void {
    this.itens.set(this.itens().filter((i) => i.chave !== chave));
    this.persistir();
  }

  limpar(): void {
    this.itens.set([]);
    this.persistir();
  }

  precoUnit(item: CartItem): number {
    return item.preco + item.opcoes.reduce((acc, o) => acc + (o.remove ? 0 : o.precoAdicional), 0);
  }

  private persistir(): void {
    if (this.slugAtual) {
      localStorage.setItem(`cart.${this.slugAtual}`, JSON.stringify(this.itens()));
    }
  }
}

export function chaveItem(item: { produtoId: string; opcoes: { opcaoId: string }[] }): string {
  const opcoes = [...item.opcoes]
    .map((o) => o.opcaoId)
    .sort()
    .join('|');
  return `${item.produtoId}[${opcoes}]`;
}
