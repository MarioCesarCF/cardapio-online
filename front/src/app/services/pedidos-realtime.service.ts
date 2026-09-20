import { inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import type { PedidoPainel } from './pedido-painel';

interface StatusPedidoEvent {
  id: string;
  numero: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class PedidosRealtimeService {
  private readonly auth = inject(AuthService);

  private socket: Socket | null = null;
  private slugAtivo = '';

  readonly conectado = signal(false);
  readonly erroRealtime = signal<string | null>(null);

  private readonly novoPedido$ = new Subject<PedidoPainel>();
  private readonly statusPedido$ = new Subject<StatusPedidoEvent>();

  readonly novosPedidos = this.novoPedido$.asObservable();
  readonly statusDePedidos = this.statusPedido$.asObservable();

  async conectar(slug: string): Promise<void> {
    if (this.slugAtivo !== slug) {
      this.desconectar();
      this.slugAtivo = slug;
    }
    if (this.socket) {
      if (this.socket.connected) {
        this.entrarSala();
      }
      return;
    }

    const token = await this.auth.tokenForRequest();
    if (!token) {
      this.erroRealtime.set('Sessão não autenticada.');
      return;
    }

    const socket = io(environment.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.conectado.set(true);
      this.erroRealtime.set(null);
      this.entrarSala();
    });
    socket.on('disconnect', () => this.conectado.set(false));
    socket.on('connect_error', (error) => {
      this.conectado.set(false);
      this.erroRealtime.set(error.message);
    });
    socket.on('pedido:novo', (pedido: PedidoPainel) => this.novoPedido$.next(pedido));
    socket.on('pedido:status', (evento: StatusPedidoEvent) => this.statusPedido$.next(evento));
    socket.on('erro', (dados: { message?: string }) => {
      if (dados?.message) {
        this.erroRealtime.set(dados.message);
      }
    });
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.conectado.set(false);
  }

  private entrarSala(): void {
    if (this.slugAtivo) {
      this.socket?.emit('loja:join', { slug: this.slugAtivo });
    }
  }
}
