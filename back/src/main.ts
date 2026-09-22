import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ErroLogFilter } from './common/erro-log.filter.js';

const SECRET_MIN_BYTES = 32;

function origemValida(valor: unknown): string | null {
  if (typeof valor !== 'string') {
    return null;
  }
  const origem = valor.trim();
  return origem.length > 0 ? origem : null;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // CORS restrito por origem (Vercel/front). A origem nunca é usada como
  // autorização — é apenas defesa em profundidade; o front autentica via Bearer.
  const frontUrl = origemValida(config.get('FRONT_URL')) ?? 'http://localhost:4200';
  const extrasRaw = origemValida(config.get('CORS_ORIGINS'));
  const extras = extrasRaw
    ? extrasRaw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : [];
  const origens = [frontUrl, ...extras];
  app.enableCors({ origin: origens });

  // Helmet (baseline de segurança). CORP vai em "cross-origin" porque o front
  // (Vercel/dev) carrega via <img> recursos servidos por esta API (logos SVG,
  // galeria) — o default "same-origin" bloquearia o carregamento.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.disable('x-powered-by');

  // Render fica atrás de proxy — sem isso o throttler vê todo mundo como um IP só.
  app.set('trust proxy', 1);

  // Chave do JWT da app: exigir secret forte ANTES de subir (o exchange já
  // falha fechado quando a chave é vazia — este check dá o erro cedo e claro).
  const secret = config.get<string>('APP_JWT_SECRET', '') ?? '';
  const secretBytes = Buffer.byteLength(secret, 'utf8');
  const emProducao = config.get('NODE_ENV') === 'production';
  if (secretBytes === 0) {
    const mensagem =
      'APP_JWT_SECRET não configurado: o POST /auth/exchange não vai funcionar. ' +
      `Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;
    if (emProducao) {
      throw new Error(mensagem);
    }
    new Logger('Bootstrap').warn(mensagem);
  } else if (secretBytes < SECRET_MIN_BYTES) {
    const mensagem = `APP_JWT_SECRET está configurado com apenas ${secretBytes} bytes (mínimo ${SECRET_MIN_BYTES}). Gere um secret aleatório com pelo menos ${SECRET_MIN_BYTES} bytes.`;
    if (emProducao) {
      throw new Error(mensagem);
    }
    new Logger('Bootstrap').warn(mensagem);
  }

  app.useGlobalFilters(new ErroLogFilter(app.get(PrismaService)));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();