import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../../common/auth/customer-jwt.guard.js';
import { CurrentMember } from '../../../common/auth/current-member.decorator.js';
import type { AuthenticatedMember } from '../../../common/auth/auth.types.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { CancelOrderDto } from '../dto/cancel-order.dto.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { ListOrdersDto } from '../dto/list-orders.dto.js';
import { QuoteDto } from '../dto/quote.dto.js';
import { OrdersService } from '../services/orders.service.js';

@ApiTags('顾客订单')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(CustomerJwtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({ summary: '服务端算价并校验商品/规格/预约时间' })
  quote(@Body() dto: QuoteDto) {
    return this.ordersService.quote(dto);
  }

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: '客户端生成的幂等键，8–64 位字母、数字、下划线或连字符',
  })
  @ApiOperation({ summary: '创建待支付订单，服务端重算金额并校验幂等' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentMember() member: AuthenticatedMember | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }

    return this.ordersService.create(dto, member.id, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: '我的订单列表，可按状态筛选' })
  list(
    @CurrentMember() member: AuthenticatedMember | undefined,
    @Query() query: ListOrdersDto,
  ) {
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }
    return this.ordersService.list(member.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '我的订单详情（含商品与状态时间线）' })
  detail(
    @CurrentMember() member: AuthenticatedMember | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }
    return this.ordersService.detail(member.id, orderId);
  }

  @Post(':id/pay')
  @HttpCode(200)
  @ApiOperation({ summary: '发起 mock 支付；重复支付返回当前订单' })
  pay(
    @CurrentMember() member: AuthenticatedMember | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ) {
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }
    return this.ordersService.pay(orderId, member.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '取消待支付订单' })
  cancel(
    @CurrentMember() member: AuthenticatedMember | undefined,
    @Param('id', new ParseUUIDPipe()) orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }
    return this.ordersService.cancel(orderId, member.id, dto);
  }
}
