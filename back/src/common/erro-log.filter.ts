import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

interface RequestComUsuario {
  user?: { id?: string } | null;
}

@Catch()
export class ErroLogFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErroInterno');

  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<import('express').Response>();
    const request = ctx.getRequest<ExpressRequest & RequestComUsuario>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const mensagem =
        exception instanceof Error
          ? exception.message
          : 'Erro interno do servidor';
      const detalhes: Record<string, unknown> = {
        metodo: request.method,
        url: request.originalUrl ?? request.url,
        status,
      };
      if (exception instanceof Error && exception.stack) {
        detalhes.stack = exception.stack.slice(0, 2000);
      }
      const usuarioId = request.user?.id ?? null;

      this.prisma.logSistema
        .create({
          data: {
            nivel: 'erro',
            categoria: 'erro',
            mensagem: `Erro interno: ${mensagem}`,
            detalhes: detalhes as Prisma.InputJsonValue,
            usuarioId,
          },
        })
        .catch((error) =>
          this.logger.warn(`Falha ao registrar erro no log: ${error}`),
        );

      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} -> ${mensagem}`,
      );
    }

    if (exception instanceof HttpException) {
      response.status(status).json(exception.getResponse());
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(status).json({
      message: 'Erro interno do servidor',
      statusCode: status,
    });
  }
}
