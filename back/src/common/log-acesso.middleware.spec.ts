import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { registraAcesso } from './log-acesso.middleware.js';
import { LogAcessoService } from './log-acesso.service.js';

type ResMock = Response & EventEmitter & { statusCode: number };

const servico = () => ({ registra: vi.fn() }) as unknown as LogAcessoService;

function request(extra: Partial<Request>): Partial<Request> {
  return {
    ip: '2001:db8::1',
    method: 'GET',
    originalUrl: '/',
    route: { path: '/' },
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
    ...extra,
  } as Partial<Request>;
}

function dispara(
  logAcesso: LogAcessoService,
  req: Partial<Request>,
  status = 200,
): ResMock {
  const res = Object.assign(new EventEmitter(), { statusCode: status }) as ResMock;
  const next = vi.fn() as unknown as NextFunction;
  registraAcesso(logAcesso)(req as Request, res, next);
  expect(next).toHaveBeenCalled();
  res.emit('finish');
  return res;
}

describe('registraAcesso', () => {
  it('registra o mínimo do art. 15 do Marco Civil: ip, método, rota e status', () => {
    const logAcesso = servico();
    dispara(logAcesso, request({ route: { path: '/pedidos/:id' } }), 201);

    expect(logAcesso.registra).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '2001:db8::1',
        metodo: 'GET',
        rota: '/pedidos/:id',
        status: 201,
        usuarioId: null,
      }),
    );
  });

  it('registra o request que não casou com rota (404 de scanner)', () => {
    const logAcesso = servico();
    dispara(logAcesso, request({ route: undefined, originalUrl: '/wp-admin/x' }), 404);

    const linha = vi.mocked(logAcesso.registra).mock.calls[0][0];
    expect(linha.rota).toBe('/wp-admin/x');
    expect(linha.status).toBe(404);
  });

  it('nunca vira um registro de acesso que é um banco de compras', () => {
    const logAcesso = servico();
    // Sem `req.route`: o caminho cru vem filtrado, sem query string e com o id
    // do pedido mascarado.
    dispara(
      logAcesso,
      request({
        route: undefined,
        originalUrl:
          '/me/pedidos/9f4a1b2c-d4e5-4f6a-8b1c-2d3e4f5a6b7c?chavePix=brcode-0001',
      }),
    );

    const linha = vi.mocked(logAcesso.registra).mock.calls[0][0];
    expect(linha.rota).toBe('/me/pedidos/:id');
    expect(JSON.stringify(linha)).not.toContain('brcode');
    expect(JSON.stringify(linha)).not.toContain('9f4a1b2c');
  });

  it('mascara referência longa (slug/id) que não é uuid', () => {
    const logAcesso = servico();
    dispara(logAcesso, request({ route: undefined, originalUrl: '/l/duarte-burguers-2026' }));

    expect(vi.mocked(logAcesso.registra).mock.calls[0][0].rota).toBe('/l/:ref');
  });

  it('associa o usuário autenticado pelo sub do JWT, sem ir ao banco', () => {
    const logAcesso = servico();
    const sub = '9f4a1b2c-d4e5-4f6a-8b1c-2d3e4f5a6b7c';
    const token = `x.${Buffer.from(JSON.stringify({ sub }), 'utf8').toString('base64url')}.y`;
    dispara(logAcesso, request({ headers: { authorization: `Bearer ${token}` } }));

    expect(vi.mocked(logAcesso.registra).mock.calls[0][0].usuarioId).toBe(sub);
  });

  it('não cai fora quando o Bearer é lixo', () => {
    const logAcesso = servico();
    dispara(logAcesso, request({ headers: { authorization: 'Bearer nao-e-jwt' } }));

    expect(vi.mocked(logAcesso.registra).mock.calls[0][0].usuarioId).toBeNull();
  });

  it('ignora a sonda de liveness do Render', () => {
    const logAcesso = servico();
    dispara(logAcesso, request({ route: { path: '/health' } }));

    expect(logAcesso.registra).not.toHaveBeenCalled();
  });

  it('deixa a requisição passar mesmo se a normalização quebrar', () => {
    const logAcesso = servico();
    vi.mocked(logAcesso.registra).mockImplementation(() => {
      throw new Error('falhou');
    });
    const req = request();
    const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as ResMock;
    const next = vi.fn() as unknown as NextFunction;

    registraAcesso(logAcesso)(req as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect(() => res.emit('finish')).not.toThrow();
  });
});