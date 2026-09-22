import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PedidoPainel } from './pedidos.types.js';

// Origem permitida no handshake WS segue a mesma política do CORS HTTP do
// main.ts (FRONT_URL + CORS_ORIGINS). Não é autorização — a autenticação é o
// JWT no handshake; é defesa em profundidade contra aberturas de origem.
function origensWs(): string[] {
  const front =
    (process.env.FRONT_URL ?? 'http://localhost:4200').trim() ||
    'http://localhost:4200';
  const extrasRaw = (process.env.CORS_ORIGINS ?? '').trim();
  const extras = extrasRaw
    ? extrasRaw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : [];
  return [...new Set([front, ...extras])];
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback) => {
      // Sem header Origin (clientes não-navegador, socket puro) → libera.
      if (!origin) {
        callback(null, true);
        return;
      }
      const permitida = origensWs().includes(origin);
      if (permitida) {
        callback(null, true);
        return;
      }
      callback(new Error('Origem não permitida.'));
    },
  },
})
@Injectable()
export class PedidosGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PedidosGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : typeof client.handshake.headers?.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null;

    if (!token) {
      client.emit('erro', { message: 'Token ausente.' });
      client.disconnect(true);
      return;
    }

    client.data.authPromise = (async () => {
      const user = await this.auth.validateSession(token);
      if (!user) {
        client.emit('erro', { message: 'Sessão inválida.' });
        client.disconnect(true);
        return false;
      }
      client.data.userId = user.id;
      this.logger.debug(`socket conectado: ${client.id} (${user.id})`);
      return true;
    })();
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`socket desconectado: ${client.id}`);
  }

  @SubscribeMessage('loja:join')
  async joinLanchonete(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string },
  ): Promise<void> {
    const autenticado = await client.data.authPromise;
    if (autenticado !== true || typeof body?.slug !== 'string') {
      client.emit('erro', { message: 'Requisição inválida.' });
      return;
    }
    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { slug: body.slug, donoId: client.data.userId },
      select: { id: true },
    });
    if (!lanchonete) {
      client.emit('erro', { message: 'Lanchonete não encontrada.' });
      return;
    }
    await client.join(`loja:${lanchonete.id}`);
    client.emit('loja:join:ok', { slug: body.slug });
  }

  emitirNovoPedido(lanchoneteId: string, pedido: PedidoPainel): void {
    this.server.to(`loja:${lanchoneteId}`).emit('pedido:novo', pedido);
  }

  emitirStatusPedido(
    lanchoneteId: string,
    payload: { id: string; numero: number; status: string },
  ): void {
    this.server.to(`loja:${lanchoneteId}`).emit('pedido:status', payload);
  }
}
