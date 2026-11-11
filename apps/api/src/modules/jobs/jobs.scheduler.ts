import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_TIME_ZONE } from '../../common/utils/time.js';
import { NoShowJob } from './services/no-show.job.js';
import { OrderExpiryJob } from './services/order-expiry.job.js';
import { ScheduledOrderReleaseJob } from './services/scheduled-order-release.job.js';

@Injectable()
export class JobsScheduler {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(
    private readonly scheduledOrderReleaseJob: ScheduledOrderReleaseJob,
    private readonly orderExpiryJob: OrderExpiryJob,
    private readonly noShowJob: NoShowJob,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'scheduled-order-release',
    timeZone: APP_TIME_ZONE,
  })
  async releaseScheduledOrders(): Promise<void> {
    await this.execute('scheduled-order-release', () =>
      this.scheduledOrderReleaseJob.run(),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'order-expiry',
    timeZone: APP_TIME_ZONE,
  })
  async expirePendingOrders(): Promise<void> {
    await this.execute('order-expiry', () => this.orderExpiryJob.run());
  }

  @Cron('59 23 * * *', {
    name: 'no-show',
    timeZone: APP_TIME_ZONE,
  })
  async closeNoShowOrders(): Promise<void> {
    await this.execute('no-show', () => this.noShowJob.run());
  }

  private async execute(
    name: string,
    task: () => Promise<number>,
  ): Promise<void> {
    try {
      const affected = await task();
      if (affected > 0) {
        this.logger.log(`${name}: processed ${affected} order(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`${name}: ${message}`, stack);
    }
  }
}
