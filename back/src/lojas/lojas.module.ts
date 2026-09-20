import { Module } from '@nestjs/common';
import { LojasService } from './lojas.service.js';
import { LojasController } from './lojas.controller.js';
import { DiretorioController } from './diretorio.controller.js';

@Module({
  controllers: [LojasController, DiretorioController],
  providers: [LojasService],
})
export class LojasModule {}
