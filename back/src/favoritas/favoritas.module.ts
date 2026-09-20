import { Module } from '@nestjs/common';
import { FavoritasController } from './favoritas.controller.js';
import { FavoritasService } from './favoritas.service.js';

@Module({
  controllers: [FavoritasController],
  providers: [FavoritasService],
})
export class FavoritasModule {}
