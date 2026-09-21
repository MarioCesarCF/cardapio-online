import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface LanchonetePainel {
  id: string;
  nome: string;
  slug: string;
  tipo: string | null;
  logoUrl: string | null;
  situacao: string;
  createdAt: string;
  donoNome: string | null;
  donoEmail: string | null;
  totalCategorias: number;
  totalProdutos: number;
  totalPedidos: number;
}

export interface AdminPainel {
  id: string;
  nome: string | null;
  email: string;
  funcao: string;
  createdAt: string;
}

export interface LogSistema {
  id: string;
  nivel: string;
  categoria: string;
  mensagem: string;
  detalhes: Record<string, unknown> | null;
  createdAt: string;
  usuarioNome: string | null;
  usuarioEmail: string | null;
}

export interface LanchoneteConsulta {
  id: string;
  nome: string;
  slug: string;
  tipo: string | null;
  logoUrl: string | null;
  fonte: string | null;
  corPrincipal: string | null;
  chavePix: string | null;
  nomePix: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  enderecoLoja: string | null;
  notifPainel: boolean;
  notifWhatsapp: boolean;
  notifEmail: boolean;
  situacao: string;
  createdAt: string;
  updatedAt: string;
  donoNome: string | null;
  donoEmail: string | null;
}

export interface GrupoConsulta {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
  opcoes: {
    id: string;
    nome: string;
    precoAdicional: number;
    remove: boolean;
    ativa: boolean;
  }[];
}

export interface ProdutoConsulta {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagemUrl: string | null;
  destaque: boolean;
  ativo: boolean;
  grupoIds: string[];
  grupos: GrupoConsulta[];
}

export interface CategoriaConsulta {
  id: string;
  nome: string;
  posicao: number;
  imagemUrl: string | null;
  ativa: boolean;
  produtos: ProdutoConsulta[];
}

export interface CardapioConsulta {
  lanchonete: {
    id: string;
    nome: string;
    slug: string;
    logoUrl: string | null;
    tipo: string | null;
    situacao: string;
  };
  categorias: CategoriaConsulta[];
}

export interface PedidoItemConsulta {
  id: string;
  nome: string;
  precoUnit: number;
  qtd: number;
  opcoes: { id: string; nome: string; precoAdicional: number; remove: boolean }[];
}

export interface PedidoConsulta {
  id: string;
  numero: number;
  status: string;
  subtotal: number;
  total: number;
  formaPagamento: string;
  enderecoEntrega: Record<string, unknown> | null;
  observacao: string | null;
  createdAt: string;
  lanchonete: { id: string; nome: string; slug: string };
  cliente: { id: string; nome: string | null; telefone: string | null } | null;
  itens: PedidoItemConsulta[];
}

@Injectable({ providedIn: 'root' })
export class PainelAdminService {
  private readonly api = inject(ApiService);

  listarLanchonetes(): Promise<LanchonetePainel[]> {
    return firstValueFrom(this.api.get<LanchonetePainel[]>('/admin-sistema/lanchonetes'));
  }

  alterarSituacao(id: string, situacao: string): Promise<LanchonetePainel> {
    return firstValueFrom(
      this.api.patch<LanchonetePainel>(`/admin-sistema/lanchonetes/${id}/situacao`, { situacao }),
    );
  }

  excluirLanchonete(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin-sistema/lanchonetes/${id}`));
  }

  consultarLanchonete(id: string): Promise<LanchoneteConsulta> {
    return firstValueFrom(this.api.get<LanchoneteConsulta>(`/admin-sistema/lanchonetes/${id}`));
  }

  consultarCardapio(id: string): Promise<CardapioConsulta> {
    return firstValueFrom(
      this.api.get<CardapioConsulta>(`/admin-sistema/lanchonetes/${id}/cardapio`),
    );
  }

  consultarPedidos(id: string): Promise<PedidoConsulta[]> {
    return firstValueFrom(
      this.api.get<PedidoConsulta[]>(`/admin-sistema/lanchonetes/${id}/pedidos`),
    );
  }

  listarLogs(params: { nivel?: string; categoria?: string }): Promise<LogSistema[]> {
    const qs = new URLSearchParams();
    if (params.nivel) qs.set('nivel', params.nivel);
    if (params.categoria) qs.set('categoria', params.categoria);
    const sufixo = qs.toString() ? `?${qs.toString()}` : '';
    return firstValueFrom(this.api.get<LogSistema[]>(`/admin-sistema/logs${sufixo}`));
  }

  listarAdmins(): Promise<AdminPainel[]> {
    return firstValueFrom(this.api.get<AdminPainel[]>('/admin-sistema/admins'));
  }

  getPlataforma(): Promise<{ emailLojista: string | null }> {
    return firstValueFrom(
      this.api.get<{ emailLojista: string | null }>('/admin-sistema/plataforma'),
    );
  }

  atualizarPlataforma(emailLojista: string | null): Promise<{ emailLojista: string | null }> {
    return firstValueFrom(
      this.api.patch<{ emailLojista: string | null }>('/admin-sistema/plataforma', {
        emailLojista,
      }),
    );
  }

  criarAdmin(body: { nome: string; email: string; senha: string }): Promise<AdminPainel> {
    return firstValueFrom(this.api.post<AdminPainel>('/admin-sistema/admins', body));
  }

  removerAdmin(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.delete<{ ok: boolean }>(`/admin-sistema/admins/${id}`));
  }

  atualizarAdmin(id: string, body: { nome: string }): Promise<AdminPainel> {
    return firstValueFrom(this.api.patch<AdminPainel>(`/admin-sistema/admins/${id}`, body));
  }
}
