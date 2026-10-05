import type { NextFunction, Request, Response } from 'express';
import { LogAcessoService } from './log-acesso.service.js';

// Registro de acesso em TODO request HTTP — inclusive nos que não casam com
// rota nenhuma (404), que é justamente o que um scanner de internet produz.
// Por isso é middleware e não interceptor: o interceptor do Nest só roda quando
// existe handler, e o art. 15 do Marco Civil não faz essa exceção.
//
// O que entra: IP, data/hora, método, rota em **template** e status HTTP. O que
// NÃO entra: corpo da requisição, query string, cabeçalhos, senha, chave PIX ou
// qualquer identificador de pedido/telefone/e-mail.
//
// A rota vai em template de propósito: `/pedidos/abc123` vira `/pedidos/:id`, senão
// o "registro de acesso" seria um banco de dados de tudo que os usuários
// compraram.
const MAX_ROTA = 120;
// `/health` é a sonda de liveness do Render (bate a cada minuto): registrar
// isso só enche a tabela e polui a trilha de uma investigação real.
const ROTAS_IGNORADAS = new Set(['/health']);

// UUID (id de usuário/pedido), slug de lanchonete e qualquer id opaco longo
// viram `:id`/`:ref` — o objetivo é que a linha não identifique ninguém, não que
// a rota seja navegável.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const LONGO = /[A-Za-z0-9_-]{16,}/;

function templateDaRota(req: Request): string {
  // `req.route.path` é o padrão da rota casada (`/pedidos/:id`) — ele só existe
  // depois que o router resolveu, e o 'finish' dispara bem depois disso. O
  // fallback é o caminho cru, ainda filtrado (é o caso do 404).
  const bruto: string =
    typeof req.route?.path === 'string'
      ? req.route.path
      : String(req.originalUrl ?? req.url ?? '').split('?')[0];
  const limpo = bruto
    .replace(UUID, ':id')
    .split('/')
    .map((segmento) =>
      LONGO.test(segmento) && !segmento.startsWith(':') ? ':ref' : segmento,
    )
    .join('/');
  return limpo.slice(0, MAX_ROTA);
}

/** Usuário autenticado sem decodificar o JWT (ver AuthService.validaToken). */
function usuarioDaRequisicao(req: Request): string | null {
  const raw = req.headers?.authorization;
  if (typeof raw !== 'string') return null;
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(partes[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const sub = payload?.sub;
    return typeof sub === 'string' && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

export function registraAcesso(logAcesso: LogAcessoService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // `finish` dispara depois que a resposta sai inteira — inclusive quando um
    // exception filter devolveu 400/401/404/500, e o `res.statusCode` já é o
    // status real.
    res.once('finish', () => {
      try {
        const rota = templateDaRota(req);
        if (ROTAS_IGNORADAS.has(rota)) return;
        logAcesso.registra({
          ip: String(req.ip ?? req.socket?.remoteAddress ?? 'desconhecido'),
          metodo: String(req.method ?? 'GET').slice(0, 8),
          rota,
          status: Number(res.statusCode ?? 0),
          usuarioId: usuarioDaRequisicao(req),
          createdAt: new Date(),
        });
      } catch {
        // Nunca derruba a requisição por causa do log (o `registra` já é
        // best-effort; isto cobre só a normalização de rota/IP).
      }
    });
    next();
  };
}