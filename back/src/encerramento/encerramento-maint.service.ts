import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Expurga o questionário de encerramento.
//
// A resposta serve para duas coisas que não duram para sempre: ver o motivo da
// saída e voltar a falar com quem liberou o contato. Passado o prazo, a linha
// inteira sai — sem exceção para "dado anonimizado", porque resposta aberta +
// nota + motivo já permite reidentificar quem sairia num grupo pequeno (uma
// lanchonete com 5 pedidos e nota 1 em 2027 é identificável). O prazo é o mesmo
// declarado na Política de Privacidade.
const INTERVALO_MS = 60 * 60 * 1000; // 1h
const IDADE_MAXIMA_MS = 24 * 30 * 24 * 60 * 60 * 1000; // 24 meses

@Injectable()
export class EncerramentoMaintService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EncerramentoMaintService.name);
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
    try {
      const removidas = await this.prisma.respostaEncerramento.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - IDADE_MAXIMA_MS) } },
      });
      if (removidas.count > 0) {
        this.logger.log(
          `Questionários de encerramento expirados (24 meses): ${removidas.count} removido(s).`,
        );
      }
    } catch (erro) {
      // Falha de manutenção nunca derruba o boot nem esconde o serviço.
      this.logger.warn(
        'Não foi possível expurgar os questionários de encerramento.',
        erro instanceof Error ? erro.message : undefined,
      );
    }
  }
}