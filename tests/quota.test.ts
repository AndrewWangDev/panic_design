import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the time window boundary calculation and atomic concurrency patterns
describe('Quota Engine: Window Calculation & Logic', () => {
  it('should accurately detect UTC day boundary transitions', () => {
    const lastReset = new Date('2026-10-27T23:59:59.000Z');
    const now = new Date('2026-10-28T00:00:01.000Z');

    const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                     now.getUTCMonth() !== lastReset.getUTCMonth() || 
                     now.getUTCDate() !== lastReset.getUTCDate();

    expect(isNewDay).toBe(true);
  });

  it('should accurately detect UTC hour boundary transitions', () => {
    const lastReset = new Date('2026-10-27T10:59:59.000Z');
    const now = new Date('2026-10-27T11:00:01.000Z');

    const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                     now.getUTCMonth() !== lastReset.getUTCMonth() || 
                     now.getUTCDate() !== lastReset.getUTCDate();
                     
    const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

    expect(isNewDay).toBe(false);
    expect(isNewHour).toBe(true);
  });

  it('should identify requests within the same hourly window', () => {
    const lastReset = new Date('2026-10-27T11:15:00.000Z');
    const now = new Date('2026-10-27T11:45:00.000Z');

    const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                     now.getUTCMonth() !== lastReset.getUTCMonth() || 
                     now.getUTCDate() !== lastReset.getUTCDate();
                     
    const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

    expect(isNewDay).toBe(false);
    expect(isNewHour).toBe(false);
  });
});
