import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Mantém o acervo de pedidos enxuto:
// - pedidos com mais de 24h viram "arquivado" (historico = true), saindo da
//   lista ativa do cliente e do painel do dono;
// - pedidos com mais de 30 dias são removidos de vez (itens/opções caem por
//   cascade). Falhas nunca derrubam o boot — apenas logam.
const INTERVALO_MS = 60 * 60 * 1000; // 1h
const IDADE_DE_ARQUIVAR_MS = 24 * 60 * 60 * 1000; // 24h
const IDADE_DE_REMOVER_MS = 30 * 24 * 60 * 60 * 1000; // 30d

@Injectable()
export class PedidosMaintService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PedidosMaintService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    void this.rodar();
    this.timer = setInterval(() => void this.rodar(), INTERVALO_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async rodar(): Promise<void> {
    const agora = Date.now();
    const arquivados = await this.prisma.pedido.updateMany({
      where: {
        arquivado: false,
        createdAt: { lt: new Date(agora - IDADE_DE_ARQUIVAR_MS) },
      },
      data: { arquivado: true },
    });

    const removidos = await this.prisma.pedido.deleteMany({
      where: { createdAt: { lt: new Date(agora - IDADE_DE_REMOVER_MS) } },
    });

    if (arquivados.count > 0 || removidos.count > 0) {
      this.logger.log(
        `Manutenção do arquivo de pedidos: ${arquivados.count} arquivado(s), ${removidos.count} removido(s).`,
      );
    }
  }
}