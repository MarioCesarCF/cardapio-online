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
import { AssetsController } from './assets/assets.controller.js';

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
  ],
  controllers: [AppController, HealthController, AssetsController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
