import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import {
  AdminProductQueryDto,
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from '../dto/admin-product.dto.js';
import { AdminCatalogService } from '../services/admin-catalog.service.js';

@ApiTags('管理端-商品')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminCatalog: AdminCatalogService) {}

  @Get()
  @ApiOperation({ summary: '商品列表（含下架/售罄）' })
  async list(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query() query: AdminProductQueryDto,
  ) {
    return {
      products: await this.adminCatalog.listProducts(staff.storeId, query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '商品详情' })
  get(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminCatalog.getProduct(staff.storeId, id);
  }

  @Post()
  @ApiOperation({ summary: '新建商品' })
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: CreateProductDto,
  ) {
    return this.adminCatalog.createProduct(staff.storeId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '上下架/沽清' })
  updateStatus(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.adminCatalog.updateProductStatus(
      staff.storeId,
      id,
      dto.status,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑商品' })
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminCatalog.updateProduct(staff.storeId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '归档商品（改为下架）' })
  async archive(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.adminCatalog.archiveProduct(staff.storeId, id);
    return { ok: true };
  }
}
