import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { DashboardQueryDto } from '../dto/dashboard-query.dto.js';
import { DashboardService } from '../services/dashboard.service.js';

@ApiTags('管理端工作台')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: '工作台经营数据' })
  getSummary(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getSummary(staff.storeId, query.date);
  }
}
