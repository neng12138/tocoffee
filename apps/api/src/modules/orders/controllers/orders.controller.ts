import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../../common/auth/customer-jwt.guard.js';
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
}
