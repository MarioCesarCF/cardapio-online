import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppService } from './whatsapp.service.js';

function respostaOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ contacts: [], messages: [{ id: 'wamid.abc' }] }),
  };
}

describe('whatsapp.service.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('configured é false sem envs de configuração', () => {
    vi.stubEnv('WA_GRAPH_TOKEN', '');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '');
    const service = new WhatsAppService();
    expect(service.configured).toBe(false);
  });

  it('enviarTemplate chama a Graph API com token, número normalizado e template', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WA_GRAPH_TOKEN', 'TOKEN_TESTE');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '123456789');
    const service = new WhatsAppService();

    await service.enviarTemplate('(27) 99928-9274', 'hello_world');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://graph.facebook.com/v21.0/123456789/messages',
    );
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer TOKEN_TESTE');
    const corpo = JSON.parse(opts.body);
    expect(corpo.messaging_product).toBe('whatsapp');
    expect(corpo.to).toBe('5527999289274');
    expect(corpo.type).toBe('template');
    expect(corpo.template.name).toBe('hello_world');
    expect(corpo.template.language.code).toBe('en_US');
    expect(corpo.template.components).toBeUndefined();
  });

  it('enviarTemplate envia parâmetros de corpo quando informados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WA_GRAPH_TOKEN', 'TOKEN');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '42');
    const service = new WhatsAppService();

    await service.enviarTemplate('5511999990001', 'pedido_novo', [
      'Duarte Burguers',
      '7',
    ]);

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Duarte Burguers' },
          { type: 'text', text: '7' },
        ],
      },
    ]);
  });

  it('enviarTemplate lança quando a API responde erro', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Session has expired.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WA_GRAPH_TOKEN', 'TOKEN');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '42');
    const service = new WhatsAppService();

    await expect(service.enviarTemplate('5511999990001', 'hello_world')).rejects.toThrow(
      /HTTP 400\): Session has expired\./,
    );
  });

  it('enviarTemplate lança quando não configurado', async () => {
    vi.stubEnv('WA_GRAPH_TOKEN', '');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '');
    const service = new WhatsAppService();
    await expect(service.enviarTemplate('5511999990001', 'hello_world')).rejects.toThrow(
      /WhatsApp não configurado/,
    );
  });

  it('enviarNovoPedido monta os coringas {1}..{5} e normaliza o número', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WA_GRAPH_TOKEN', 'TOKEN');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '42');
    vi.stubEnv('WA_TEMPLATE_PEDIDO_NOVO', 'pedido_novo');
    vi.stubEnv('WA_TEMPLATE_LANG', 'pt_BR');
    const service = new WhatsAppService();

    await service.enviarNovoPedido(
      { nome: 'Duarte Burguers', whatsapp: '5511999990001' },
      {
        numero: 7,
        total: 42.9,
        tipoEntrega: 'entrega',
        formaPagamento: 'pix',
      },
    );

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.to).toBe('5511999990001');
    expect(corpo.template.name).toBe('pedido_novo');
    expect(corpo.template.language.code).toBe('pt_BR');
    expect(corpo.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(
      ['Duarte Burguers', '7', 'R$ 42,90', 'Entrega', 'Pix'],
    );
  });

  it('enviarNovoPedido não chama a API quando a loja não tem whatsapp', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WA_GRAPH_TOKEN', 'TOKEN');
    vi.stubEnv('WA_PHONE_NUMBER_ID', '42');
    const service = new WhatsAppService();

    await service.enviarNovoPedido(
      { nome: 'Sem Contato', whatsapp: null },
      { numero: 1, total: 10, tipoEntrega: 'retirar', formaPagamento: 'dinheiro' },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});