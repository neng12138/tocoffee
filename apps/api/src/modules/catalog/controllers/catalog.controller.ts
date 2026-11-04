import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../services/catalog.service.js';

@ApiTags('菜单')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('menu')
  @ApiOperation({ summary: '当前门店完整菜单' })
  getMenu() {
    return this.catalogService.getMenu();
  }

  @Get('products/:id')
  @ApiOperation({ summary: '商品详情' })
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getProduct(id);
  }
}
