import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { AdminListOrdersDto } from '../dto/admin-list-orders.dto.js';
import { RejectOrderDto } from '../dto/reject-order.dto.js';
import { AdminOrdersService } from '../services/admin-orders.service.js';

@ApiTags('管理端订单')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(StaffJwtGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: '订单看板列表，按 Tab/日期/类型/关键字筛选' })
  list(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Query() query: AdminListOrdersDto,
  ) {
    return this.adminOrdersService.list(this.requireStaff(staff).storeId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '订单详情与状态时间线' })
  detail(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    return this.adminOrdersService.detail(
      this.requireStaff(staff).storeId,
      orderId,
    );
  }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: '接单：PAID → ACCEPTED' })
  accept(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    const current = this.requireStaff(staff);
    return this.adminOrdersService.accept(current.storeId, orderId, current.id);
  }

  @Post(':id/ready')
  @HttpCode(200)
  @ApiOperation({ summary: '出杯：ACCEPTED → READY' })
  ready(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    const current = this.requireStaff(staff);
    return this.adminOrdersService.ready(current.storeId, orderId, current.id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: '确认取餐：READY → COMPLETED' })
  complete(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    const current = this.requireStaff(staff);
    return this.adminOrdersService.complete(current.storeId, orderId, current.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: '拒单退款：PAID/ACCEPTED/READY/NO_SHOW → REFUNDED' })
  reject(
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
    @Body() dto: RejectOrderDto,
  ) {
    const current = this.requireStaff(staff);
    return this.adminOrdersService.reject(
      current.storeId,
      orderId,
      current.id,
      dto,
    );
  }

  private requireStaff(
    staff: AuthenticatedStaff | undefined,
  ): AuthenticatedStaff {
    if (!staff) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }
    return staff;
  }
}
