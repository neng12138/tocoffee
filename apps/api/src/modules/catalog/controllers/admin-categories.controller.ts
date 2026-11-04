import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/admin-category.dto.js';
import { AdminCatalogService } from '../services/admin-catalog.service.js';

@ApiTags('管理端-分类')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly adminCatalog: AdminCatalogService) {}

  @Get()
  @ApiOperation({ summary: '分类列表（含停用）' })
  async list(@CurrentStaff() staff: AuthenticatedStaff) {
    return { categories: await this.adminCatalog.listCategories(staff.storeId) };
  }

  @Post()
  @ApiOperation({ summary: '新建分类' })
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.adminCatalog.createCategory(staff.storeId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑分类' })
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminCatalog.updateCategory(staff.storeId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '归档分类（不物理删除）' })
  async archive(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.adminCatalog.archiveCategory(staff.storeId, id);
    return { ok: true };
  }
}
