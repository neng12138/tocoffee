import { Injectable } from '@nestjs/common';

@Injectable()
export class PickupCodeService {
  /**
   * 取餐码格式：前缀 + 至少 3 位序号（A001）。
   * 超过 999 后自然扩到 4 位；P0 单店日单量不会接近 9999。
   */
  format(prefix: string, seq: number): string {
    if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
      throw new RangeError('取餐码序号必须在 1–9999 之间');
    }

    const safePrefix = (prefix.trim() || 'A').slice(0, 4);
    const width = seq > 999 ? 4 : 3;
    return `${safePrefix}${String(seq).padStart(width, '0')}`;
  }
}
