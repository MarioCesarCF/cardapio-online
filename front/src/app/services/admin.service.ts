import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import type { PedidoPainel } from './pedido-painel';

export type SituacaoLanchonete = 'pendente' | 'ativa' | 'pausada';

export interface LanchoneteResumo {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  tipo: string | null;
  situacao: SituacaoLanchonete;
}

export interface LanchoneteConfig {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  fonte: string | null;
  corPrincipal: string | null;
  tipo: string | null;
  chavePix: string | null;
  nomePix: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  enderecoLoja: string | null;
  notifPainel: boolean;
  notifWhatsapp: boolean;
  notifEmail: boolean;
  situacao: SituacaoLanchonete;
  ativa: boolean;
}

export interface OpcaoAdmin {
  id: string;
  nome: string;
  precoAdicional: number;
  remove: boolean;
  ativa: boolean;
}

export interface GrupoAdmin {
  id: string;
  nome: string;
  tipo: 'unica' | 'multipla';
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
  opcoes: OpcaoAdmin[];
}

export interface ProdutoAdmin {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagemUrl: string | null;
  destaque: boolean;
  ativo: boolean;
  grupoIds: string[];
}

export interface CategoriaAdmin {
  id: string;
  nome: string;
  posicao: number;
  imagemUrl: string | null;
  ativa: boolean;
  produtos: ProdutoAdmin[];
}

export interface CardapioAdmin {
  lanchonete: LanchoneteConfig;
  grupos: GrupoAdmin[];
  categorias: CategoriaAdmin[];
}

type Body = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  listMine(): Promise<LanchoneteResumo[]> {
    return firstValueFrom(this.api.get<LanchoneteResumo[]>('/admin/lanchonetes'));
  }

  createLanchonete(body: Body): Promise<LanchoneteResumo> {
    return firstValueFrom(this.api.post<LanchoneteResumo>('/admin/lanchonetes', body));
  }

  getConfig(slug: string): Promise<LanchoneteConfig> {
    return firstValueFrom(this.api.get<LanchoneteConfig>(`/admin/lanchonetes/${slug}`));
  }

  updateConfig(slug: string, body: Body): Promise<LanchoneteConfig> {
    return firstValueFrom(this.api.patch<LanchoneteConfig>(`/admin/lanchonetes/${slug}`, body));
  }

  removeLanchonete(slug: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin/lanchonetes/${slug}`));
  }

  getCardapio(slug: string): Promise<CardapioAdmin> {
    return firstValueFrom(this.api.get<CardapioAdmin>(`/admin/lanchonetes/${slug}/cardapio`));
  }

  createCategoria(slug: string, body: Body): Promise<CategoriaAdmin> {
    return firstValueFrom(
      this.api.post<CategoriaAdmin>(`/admin/lanchonetes/${slug}/categorias`, body),
    );
  }

  updateCategoria(idCat: string, body: Body): Promise<CategoriaAdmin> {
    return firstValueFrom(this.api.patch<CategoriaAdmin>(`/admin/categorias/${idCat}`, body));
  }

  removeCategoria(idCat: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin/categorias/${idCat}`));
  }

  createProduto(idCat: string, body: Body): Promise<ProdutoAdmin> {
    return firstValueFrom(this.api.post<ProdutoAdmin>(`/admin/categorias/${idCat}/produtos`, body));
  }

  updateProduto(idProd: string, body: Body): Promise<ProdutoAdmin> {
    return firstValueFrom(this.api.patch<ProdutoAdmin>(`/admin/produtos/${idProd}`, body));
  }

  removeProduto(idProd: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin/produtos/${idProd}`));
  }

  setProdutoGrupos(idProd: string, grupoIds: string[]): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.api.put<{ ok: boolean }>(`/admin/produtos/${idProd}/grupos`, { grupoIds }),
    );
  }

  createGrupo(slug: string, body: Body): Promise<GrupoAdmin> {
    return firstValueFrom(this.api.post<GrupoAdmin>(`/admin/lanchonetes/${slug}/grupos`, body));
  }

  updateGrupo(idGrupo: string, body: Body): Promise<GrupoAdmin> {
    return firstValueFrom(this.api.patch<GrupoAdmin>(`/admin/grupos/${idGrupo}`, body));
  }

  removeGrupo(idGrupo: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin/grupos/${idGrupo}`));
  }

  createOpcao(idGrupo: string, body: Body): Promise<OpcaoAdmin> {
    return firstValueFrom(this.api.post<OpcaoAdmin>(`/admin/grupos/${idGrupo}/opcoes`, body));
  }

  updateOpcao(idOpcao: string, body: Body): Promise<OpcaoAdmin> {
    return firstValueFrom(this.api.patch<OpcaoAdmin>(`/admin/opcoes/${idOpcao}`, body));
  }

  removeOpcao(idOpcao: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin/opcoes/${idOpcao}`));
  }

  listPedidos(slug: string, status?: string): Promise<PedidoPainel[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return firstValueFrom(
      this.api.get<PedidoPainel[]>(`/admin/lanchonetes/${slug}/pedidos${query}`),
    );
  }

  updatePedidoStatus(idPedido: string, status: string): Promise<PedidoPainel> {
    return firstValueFrom(
      this.api.patch<PedidoPainel>(`/admin/pedidos/${idPedido}/status`, { status }),
    );
  }
}
