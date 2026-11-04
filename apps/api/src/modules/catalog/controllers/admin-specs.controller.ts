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
  CreateSpecGroupDto,
  CreateSpecOptionDto,
  UpdateSpecGroupDto,
  UpdateSpecOptionDto,
} from '../dto/admin-spec.dto.js';
import { AdminCatalogService } from '../services/admin-catalog.service.js';

@ApiTags('管理端-规格组')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/spec-groups')
export class AdminSpecGroupsController {
  constructor(private readonly adminCatalog: AdminCatalogService) {}

  @Get()
  @ApiOperation({ summary: '规格组列表（含选项）' })
  async list(@CurrentStaff() staff: AuthenticatedStaff) {
    return { groups: await this.adminCatalog.listSpecGroups(staff.storeId) };
  }

  @Post()
  @ApiOperation({ summary: '新建规格组' })
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: CreateSpecGroupDto,
  ) {
    return this.adminCatalog.createSpecGroup(staff.storeId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑规格组' })
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecGroupDto,
  ) {
    return this.adminCatalog.updateSpecGroup(staff.storeId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除未被商品使用的规格组' })
  async remove(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.adminCatalog.deleteSpecGroup(staff.storeId, id);
    return { ok: true };
  }

  @Post(':id/options')
  @ApiOperation({ summary: '新建规格选项' })
  createOption(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSpecOptionDto,
  ) {
    return this.adminCatalog.createSpecOption(staff.storeId, id, dto);
  }
}

@ApiTags('管理端-规格选项')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/spec-options')
export class AdminSpecOptionsController {
  constructor(private readonly adminCatalog: AdminCatalogService) {}

  @Patch(':id')
  @ApiOperation({ summary: '编辑规格选项' })
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecOptionDto,
  ) {
    return this.adminCatalog.updateSpecOption(staff.storeId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除规格选项' })
  async remove(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.adminCatalog.deleteSpecOption(staff.storeId, id);
    return { ok: true };
  }
}
