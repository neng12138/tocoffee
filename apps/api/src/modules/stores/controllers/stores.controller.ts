import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoresService } from '../services/stores.service.js';

@ApiTags('门店')
@Controller('store')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: '当前门店信息与营业状态' })
  getStore() {
    return this.storesService.getStore();
  }
}
