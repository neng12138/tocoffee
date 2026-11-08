import { describe, expect, it } from 'vitest';
import { PickupCodeService } from './pickup-code.service.js';

describe('PickupCodeService', () => {
  const service = new PickupCodeService();

  it('pads the sequence to three digits', () => {
    expect(service.format('A', 1)).toBe('A001');
    expect(service.format('B', 42)).toBe('B042');
  });

  it('keeps A999 unchanged and expands to four digits after 999', () => {
    expect(service.format('A', 999)).toBe('A999');
    expect(service.format('A', 1000)).toBe('A1000');
  });

  it('falls back to A for an empty prefix and caps the prefix at four characters', () => {
    expect(service.format('', 7)).toBe('A007');
    expect(service.format('TOCO', 7)).toBe('TOCO007');
    expect(service.format('ABCDE', 7)).toBe('ABCD007');
  });

  it('rejects sequence numbers outside 1–9999', () => {
    expect(() => service.format('A', 0)).toThrow(RangeError);
    expect(() => service.format('A', 10_000)).toThrow(RangeError);
  });
});
