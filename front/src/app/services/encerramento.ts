// Questionário de encerramento (exit survey): catálogos e payload.
//
// Os slugs aqui são os MESMOS validados em back/src/encerramento/encerramento.types.ts
// (o back guarda o slug, o front mostra o rótulo). Ao mudar um slug, mude nos
// dois arquivos — o back rejeita o que não reconhecer.
//
// Princípio do fluxo: o questionário é opcional e nunca pode virar barreira
// para encerrar a conta. A confirmação vem primeiro e sempre existe um caminho
// de um clique ("encerrar sem responder").

import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export type PerfilEncerramento = 'cliente' | 'lanchonete';

export interface OpcaoEncerramento {
  valor: string;
  rotulo: string;
  /** Só na escala de satisfação (1 a 5). */
  emoji?: string;
}

export const MOTIVOS_CLIENTE: OpcaoEncerramento[] = [
  { valor: 'nao_uso_mais', rotulo: 'Não uso mais o Peditto' },
  { valor: 'nao_pedo_online', rotulo: 'Não costumo fazer pedidos online' },
  { valor: 'problema_pedido', rotulo: 'Tive algum problema ao fazer um pedido' },
  { valor: 'problema_lanchonete', rotulo: 'Tive algum problema com uma lanchonete' },
  { valor: 'dificuldade_uso', rotulo: 'Tive dificuldade para usar a plataforma' },
  { valor: 'notificacoes', rotulo: 'Recebi muitas notificações' },
  { valor: 'nao_quero_conta', rotulo: 'Não quero manter uma conta no Peditto' },
  { valor: 'outra_forma', rotulo: 'Prefiro outra forma de fazer pedidos' },
  { valor: 'outro', rotulo: 'Outro motivo' },
];

export const MOTIVOS_LANCHONETE: OpcaoEncerramento[] = [
  { valor: 'sem_pedidos', rotulo: 'Não estou recebendo pedidos suficientes' },
  { valor: 'preco', rotulo: 'O Peditto ficou caro para o que eu preciso' },
  { valor: 'outra_plataforma', rotulo: 'Estou usando outra plataforma' },
  {
    valor: 'dificuldade_uso',
    rotulo: 'Não consegui configurar ou utilizar o Peditto como esperava',
  },
  { valor: 'falta_recurso', rotulo: 'Está faltando alguma funcionalidade importante' },
  { valor: 'problemas_tecnicos', rotulo: 'Tive problemas técnicos' },
  { valor: 'problemas_pagamento', rotulo: 'Tive problemas com pagamentos' },
  { valor: 'atendimento', rotulo: 'Tive problemas com atendimento/suporte' },
  { valor: 'fechei_lanchonete', rotulo: 'Minha lanchonete encerrou ou mudou de atividade' },
  { valor: 'nao_preciso', rotulo: 'Não preciso mais de um sistema de pedidos online' },
  { valor: 'temporario', rotulo: 'Estou apenas encerrando por enquanto' },
  { valor: 'outro', rotulo: 'Outro motivo' },
];

/** "O que mais influenciou sua decisão?" — o back aceita no máximo 3. */
export const FATORES_LANCHONETE: OpcaoEncerramento[] = [
  { valor: 'preco', rotulo: 'Preço' },
  { valor: 'quantidade_pedidos', rotulo: 'Quantidade de pedidos' },
  { valor: 'facilidade_uso', rotulo: 'Facilidade de uso' },
  { valor: 'config_cardapio', rotulo: 'Configuração do cardápio' },
  { valor: 'recebimento_pedidos', rotulo: 'Recebimento e gerenciamento dos pedidos' },
  { valor: 'pagamentos', rotulo: 'Pagamentos' },
  { valor: 'entregas', rotulo: 'Entregas' },
  { valor: 'divulgacao', rotulo: 'Divulgação para os clientes' },
  { valor: 'relatorios', rotulo: 'Relatórios e informações sobre vendas' },
  { valor: 'personalizacao', rotulo: 'Personalização da loja' },
  { valor: 'atendimento', rotulo: 'Atendimento' },
  { valor: 'recursos_faltantes', rotulo: 'Recursos que estavam faltando' },
  { valor: 'problemas_tecnicos', rotulo: 'Problemas técnicos' },
  { valor: 'outro', rotulo: 'Outro' },
];

/** "O Peditto ajudou sua lanchonete a receber pedidos?" */
export const AJUDOU_PEDIDOS: OpcaoEncerramento[] = [
  { valor: 'ajudou_bastante', rotulo: 'Sim, bastante' },
  { valor: 'ajudou_um_pouco', rotulo: 'Sim, um pouco' },
  { valor: 'sem_diferenca', rotulo: 'Não fez diferença' },
  { valor: 'nao_consegui', rotulo: 'Não consegui receber pedidos' },
  { valor: 'nao_usei_bem', rotulo: 'Não cheguei a usar o suficiente para saber' },
];

/** Só aparece quando o motivo principal é "preco". */
export const PRECO_ADEQUADO: OpcaoEncerramento[] = [
  { valor: 'ate_29', rotulo: 'Até R$ 29,90' },
  { valor: 'faixa_30_49', rotulo: 'R$ 30 a R$ 49,90' },
  { valor: 'faixa_50_69', rotulo: 'R$ 50 a R$ 69,90' },
  { valor: 'faixa_70_99', rotulo: 'R$ 70 a R$ 99,90' },
  { valor: 'cem_ou_mais', rotulo: 'R$ 100 ou mais' },
  { valor: 'nao_sei', rotulo: 'Não sei' },
];

export const SATISFACAO: OpcaoEncerramento[] = [
  { valor: '1', rotulo: 'Muito ruim', emoji: '😞' },
  { valor: '2', rotulo: 'Ruim', emoji: '🙁' },
  { valor: '3', rotulo: 'Regular', emoji: '😐' },
  { valor: '4', rotulo: 'Boa', emoji: '🙂' },
  { valor: '5', rotulo: 'Muito boa', emoji: '😄' },
];

export const VOLTARIA: OpcaoEncerramento[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'talvez', rotulo: 'Talvez' },
  { valor: 'nao', rotulo: 'Não' },
];

export const MAX_SECUNDARIOS = 3;

export function motivosDo(perfil: PerfilEncerramento): OpcaoEncerramento[] {
  return perfil === 'lanchonete' ? MOTIVOS_LANCHONETE : MOTIVOS_CLIENTE;
}

/** Corpo enviado ao back (POST /me/encerramento ou /admin/lanchonetes/:slug/encerramento). */
export interface RespostaEncerramentoPayload {
  motivoPrincipal: string;
  motivosSecundarios?: string[];
  ajudouPedidos?: string;
  precoAdequado?: string;
  funcionalidadeFaltante?: string;
  satisfacao?: number;
  voltaria?: string;
  contatoLiberado?: boolean;
  contato?: string;
  melhorar?: string;
  paraContinuar?: string;
  experiencia?: string;
}

/** Resumo dos motivos devolvido por GET /admin-sistema/encerramentos. */
export interface ResumoEncerramentos {
  dias: number;
  total: number;
  porPerfil: { cliente: number; lanchonete: number };
  motivos: {
    perfil: PerfilEncerramento;
    total: number;
    motivos: { motivo: string; rotulo: string; quantidade: number; percentual: number }[];
  }[];
  fatores: { fator: string; rotulo: string; quantidade: number }[];
  satisfacaoMedia: number | null;
  avaliacoes: number;
  voltaria: { resposta: string | null; rotulo: string; quantidade: number }[];
  precoAdequado: { faixa: string | null; rotulo: string; quantidade: number }[];
  contatos: {
    perfil: string;
    lanchoneteNome: string | null;
    motivoPrincipal: string;
    createdAt: string;
    contato: string | null;
  }[];
  falas: {
    perfil: string;
    lanchoneteNome: string | null;
    motivoPrincipal: string;
    melhorar: string | null;
    experiencia: string | null;
    createdAt: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class EncerramentoService {
  private readonly api = inject(ApiService);

  /** Envia o questionário do cliente. */
  registrarCliente(payload: RespostaEncerramentoPayload): Promise<{ ok: boolean; id: string }> {
    return firstValueFrom(this.api.post<{ ok: boolean; id: string }>('/me/encerramento', payload));
  }

  /** Envia o questionário da lanchonete (dono da loja). */
  registrarLanchonete(
    slug: string,
    payload: RespostaEncerramentoPayload,
  ): Promise<{ ok: boolean; id: string }> {
    return firstValueFrom(
      this.api.post<{ ok: boolean; id: string }>(
        `/admin/lanchonetes/${slug}/encerramento`,
        payload,
      ),
    );
  }

  /** Painel de motivos de cancelamento (admin da plataforma). */
  resumo(dias = 90): Promise<ResumoEncerramentos> {
    return firstValueFrom(
      this.api.get<ResumoEncerramentos>(`/admin-sistema/encerramentos?dias=${dias}`),
    );
  }
}
