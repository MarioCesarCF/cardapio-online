import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ErroLogFilter } from './common/erro-log.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ErroLogFilter(app.get(PrismaService)));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
