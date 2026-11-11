import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { UpdateStoreDto } from '../dto/update-store.dto.js';
import { AdminStoresService } from '../services/admin-stores.service.js';

@ApiTags('管理端门店设置')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/store')
export class AdminStoresController {
  constructor(private readonly adminStoresService: AdminStoresService) {}

  @Get()
  @ApiOperation({ summary: '当前员工所属门店的完整设置' })
  getStore(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.adminStoresService.getStore(staff.storeId);
  }

  @Patch()
  @ApiOperation({ summary: '更新门店设置（仅店主）' })
  updateStore(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.adminStoresService.updateStore(staff.storeId, staff.role, dto);
  }
}
