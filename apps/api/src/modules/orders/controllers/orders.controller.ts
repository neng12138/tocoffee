import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
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
import { CreateOrderDto } from '../dto/create-order.dto.js';
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
}
