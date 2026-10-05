import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { LojasModule } from './lojas/lojas.module.js';
import { MeModule } from './me/me.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PedidosModule } from './pedidos/pedidos.module.js';
import { R2Module } from './r2/r2.module.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';
import { GaleriaModule } from './galeria/galeria.module.js';
import { AdminSistemaModule } from './admin-sistema/admin-sistema.module.js';
import { FavoritasModule } from './favoritas/favoritas.module.js';
import { PlataformaModule } from './plataforma/plataforma.module.js';
import { EncerramentoModule } from './encerramento/encerramento.module.js';
import { AssetsController } from './assets/assets.controller.js';
import { criarTracker } from './common/limite-taxa.js';
import { LogAcessoService } from './common/log-acesso.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: 100,
            skipIf: () => config.get('THROTTLE_DISABLED') === 'true',
          },
        ],
        // Balde por usuário autenticado, por IP só no público (ver `limite-taxa.ts`
        // para o caso do CGNAT). Sem isto, um CGNAT de operadora estoura o limite
        // global e derruba todo mundo junto.
        getTracker: criarTracker(config.get<string>('APP_JWT_SECRET', '')),
      }),
    }),
    PrismaModule,
    R2Module,
    WhatsAppModule,
    AuthModule,
    LojasModule,
    MeModule,
    AdminModule,
    PedidosModule,
    GaleriaModule,
    AdminSistemaModule,
    FavoritasModule,
    PlataformaModule,
    EncerramentoModule,
  ],
  controllers: [AppController, HealthController, AssetsController],
  providers: [
    AppService,
    // Buffer do registro de acesso (art. 15 do Marco Civil). O middleware que
    // escreve nele é registrado em `main.ts` — precisa ser `app.use`, porque
    // interceptor não vê request sem rota casada.
    LogAcessoService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
