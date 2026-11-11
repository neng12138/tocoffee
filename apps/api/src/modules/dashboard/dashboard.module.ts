import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminDashboardController } from './controllers/admin-dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminDashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
