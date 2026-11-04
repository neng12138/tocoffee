import { Module } from '@nestjs/common';
import { StoresController } from './controllers/stores.controller.js';
import { StoresService } from './services/stores.service.js';

@Module({
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
