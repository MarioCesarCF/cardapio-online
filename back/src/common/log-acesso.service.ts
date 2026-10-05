import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Registro de acesso à API — obrigação do art. 15 da Lei 12.965/2014 (Marco Civil
// da Internet): data/hora, IP, método, rota em template e status, sob sigilo e
// pelo prazo mínimo de 6 meses.
//
// Por que o buffer: escrever uma linha por requisição direto no Postgres
// adiciona uma ida ao banco (Neon é serverless, morando em outra região) em
// TODA requisição — inclusive nas de leitura do cardápio. Guardamos em memória e
// gravamos em lote (`createMany`), o que corta o custo por requisição para perto
// de zero. O que estiver no buffer quando o processo morre sem chance de flush
// (SIGKILL) se perde: registro de acesso é evidência de que houve acesso, não um
// balanço da operação — perder algumas linhas é melhor do que derrubar um pedido.
//
// Nunca entra corpo de requisição, query string, senha, chave PIX, nome, e-mail
// ou telefone (ver LogAcesso no schema.prisma).
const INTERVALO_MS = 30 * 1000; // 30s
const MAX_LOTE = 200; // linhas por createMany
const MAX_BUFFER = 1000; // teto: acima disso, descarta as mais antigas
const RETENCAO_MS = 180 * 24 * 60 * 60 * 1000; // 180d (o MCI pede no mínimo 6 meses)
const INTERVALO_EXPURGA_MS = 60 * 60 * 1000; // 1h

export interface LinhaAcesso {
  ip: string;
  metodo: string;
  rota: string;
  status: number;
  usuarioId: string | null;
  createdAt: Date;
}

@Injectable()
export class LogAcessoService
  implements OnApplicationBootstrap, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(LogAcessoService.name);
  private buffer: LinhaAcesso[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerExpurga: ReturnType<typeof setInterval> | null = null;
  private avisoDeFalha = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.descarregar(), INTERVALO_MS);
    this.timer.unref?.();
    // Retenção: sem isto a expurga de 180 dias nunca roda sozinha e a tabela
    // cresce para sempre. Na hora do boot e depois de 1 em 1 hora.
    this.timerExpurga = setInterval(() => this.expurgarEmSegundoPlano(), INTERVALO_EXPURGA_MS);
    this.timerExpurga.unref?.();
    this.expurgarEmSegundoPlano();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.timerExpurga) clearInterval(this.timerExpurga);
  }

  /**
   * No deploy o Render manda SIGTERM e o Nest fecha as conexões: dá para gravar
   * o resto do buffer. Depende de `enableShutdownHooks()` no `main.ts` — sem
   * isso o processo morre no SIGTERM e este hook nunca roda.
   */
  async beforeApplicationShutdown(): Promise<void> {
    await this.descarregar();
  }

  /**
   * Enfileira uma linha. Nunca lança: um log que derruba o pedido é pior que
   * um log que não foi escrito.
   */
  registra(linha: LinhaAcesso): void {
    if (this.buffer.length >= MAX_BUFFER) {
      this.buffer.shift();
    }
    this.buffer.push(linha);
    if (this.buffer.length >= MAX_LOTE) {
      void this.descarregar();
    }
  }

  /** Grava o que está no buffer e devolve as linhas que falharam para a fila. */
  async descarregar(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lote = this.buffer.splice(0, MAX_LOTE);
    try {
      await this.prisma.logAcesso.createMany({ data: lote });
      this.avisoDeFalha = false;
    } catch (error) {
      // Devolve o lote ao começo da fila (é o mais antigo, e é o que a retenção
      // do art. 15 exige guardar mais tempo). `registra` continua descartando a
      // linha mais antiga se estourar MAX_BUFFER, então isso não cresce sem teto.
      this.buffer.unshift(...lote);
      // Uma advertência por sequência de falhas: se o banco caiu, a cada 30s um
      // stack trace polui o log e ajuda menos do que uma linha.
      if (!this.avisoDeFalha) {
        this.avisoDeFalha = true;
        this.logger.warn(
          'Não foi possível gravar o registro de acesso (lote devolvido ao buffer, será tentando de novo).',
          error instanceof Error ? error.message : undefined,
        );
      }
    }
  }

  /** Expurga o que passou de 180 dias (o prazo do Marco Civil é mínimo). */
  async expurgar(): Promise<void> {
    const removidos = await this.prisma.logAcesso.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENCAO_MS) } },
    });
    if (removidos.count > 0) {
      this.logger.log(
        `Registros de acesso expirados (180d): ${removidos.count} removido(s).`,
      );
    }
  }

  private expurgarEmSegundoPlano(): void {
    void this.expurgar().catch((error: unknown) => {
      this.logger.warn(
        'Não foi possível expurgar o registro de acesso vencido.',
        error instanceof Error ? error.message : undefined,
      );
    });
  }
}