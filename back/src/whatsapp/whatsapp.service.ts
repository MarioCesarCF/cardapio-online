import { Injectable, Logger } from '@nestjs/common';
import { normalizarNumeroWhatsApp } from './whatsapp.utils.js';

const ROTULO_TIPO_ENTREGA: Record<string, string> = {
  entrega: 'Entrega',
  retirar: 'Retirada',
  consumir: 'Consumo no local',
};
const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

// Meta WhatsApp Cloud API (oficial). Configurado via env; sem env, `configured`
// = false e nenhum envio acontece (a notificação é silenciosamente ignorada).
// Nunca logamos o token nem o payload - só erros de resposta da própria API.
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly lang: string;
  private readonly templatePedidoNovo: string;

  constructor() {
    this.token = process.env.WA_GRAPH_TOKEN?.trim() ?? '';
    this.phoneNumberId = process.env.WA_PHONE_NUMBER_ID?.trim() ?? '';
    this.apiVersion = process.env.WA_GRAPH_VERSION?.trim() || 'v21.0';
    this.lang = process.env.WA_TEMPLATE_LANG?.trim() || 'en_US';
    this.templatePedidoNovo =
      process.env.WA_TEMPLATE_PEDIDO_NOVO?.trim() || 'hello_world';
  }

  get configured(): boolean {
    return !!this.token && !!this.phoneNumberId;
  }

  // Envia um template aprovado (obrigatório: a Meta não aceita mensagem livre
  // como primeira mensagem de uma conversa). `params` preenchem os coringas
  // {1}..{N} do corpo do template (ex.: pedido_novo aprovado no Business Manager).
  async enviarTemplate(
    numero: string,
    nomeTemplate: string,
    params: string[] = [],
    lang: string = this.lang,
  ): Promise<void> {
    if (!this.configured) {
      throw new Error(
        'WhatsApp não configurado: defina WA_GRAPH_TOKEN e WA_PHONE_NUMBER_ID.',
      );
    }
    const to = normalizarNumeroWhatsApp(numero);
    const template: Record<string, unknown> = {
      name: nomeTemplate,
      language: { code: lang },
    };
    if (params.length > 0) {
      template.components = [
        { type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) },
      ];
    }
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template,
    };

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const corpo = (await resposta
      .json()
      .catch(() => null)) as { error?: { message?: string } } | null;
    if (!resposta.ok || corpo?.error) {
      throw new Error(
        `Falha ao enviar WhatsApp (HTTP ${resposta.status}): ${
          corpo?.error?.message ?? 'resposta inesperada da API'
        }`,
      );
    }
  }

  // Notificação de novo pedido ao dono (template de produção usa os coringas
  // {1} lanchonete, {2} número, {3} total, {4} tipo de entrega, {5} pagamento).
  async enviarNovoPedido(
    lanchonete: { nome: string; whatsapp: string | null },
    pedido: {
      numero: number;
      total: number;
      tipoEntrega: string;
      formaPagamento: string;
    },
  ): Promise<void> {
    if (!lanchonete.whatsapp) {
      return;
    }
    const total = `R$ ${Number(pedido.total).toFixed(2).replace('.', ',')}`;
    await this.enviarTemplate(lanchonete.whatsapp, this.templatePedidoNovo, [
      lanchonete.nome,
      String(pedido.numero),
      total,
      ROTULO_TIPO_ENTREGA[pedido.tipoEntrega] ?? pedido.tipoEntrega,
      ROTULO_FORMA_PAGAMENTO[pedido.formaPagamento] ?? pedido.formaPagamento,
    ]);
  }
}