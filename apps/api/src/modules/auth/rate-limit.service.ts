import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/errors/error-codes.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60_000;

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS): void {
    const now = Date.now();
    this.cleanupIfNeeded(now);

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      throw new AppError(
        ERROR_CODES.RATE_LIMITED,
        '操作过于频繁，请稍后再试',
        429,
        { retryAfterSeconds },
      );
    }
  }

  private cleanupIfNeeded(now: number): void {
    if (this.buckets.size < 5_000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
