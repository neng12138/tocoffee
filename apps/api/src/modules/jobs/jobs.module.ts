import { Module } from '@nestjs/common';
import { JobsScheduler } from './jobs.scheduler.js';
import { NoShowJob } from './services/no-show.job.js';
import { OrderExpiryJob } from './services/order-expiry.job.js';
import { ScheduledOrderReleaseJob } from './services/scheduled-order-release.job.js';

@Module({
  providers: [
    ScheduledOrderReleaseJob,
    OrderExpiryJob,
    NoShowJob,
    JobsScheduler,
  ],
  exports: [
    ScheduledOrderReleaseJob,
    OrderExpiryJob,
    NoShowJob,
  ],
})
export class JobsModule {}
