import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndUpdateQuota, refundQuota } from '../src/lib/quota';

// Mock Prisma
const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock('../src/lib/prisma', () => ({
  getPrisma: () => ({
    user: {
      findUnique: mockFindUnique,
      updateMany: mockUpdateMany
    }
  })
}));

describe('Quota Engine: Core Logic & Concurrency Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when user is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await checkAndUpdateQuota('non-existent-user');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User not found');
  });

  it('should grant access and atomically increment quota within limits', async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      dailyQuota: 5,
      hourlyQuota: 2,
      lastQuotaReset: now
    });

    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await checkAndUpdateQuota('user-1');
    expect(result.allowed).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-1',
          dailyQuota: { lt: 100 },
          hourlyQuota: { lt: 30 }
        }),
        data: expect.objectContaining({
          dailyQuota: { increment: 1 },
          hourlyQuota: { increment: 1 }
        })
      })
    );
  });

  it('should block request when hourly limit (30) is exceeded', async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      dailyQuota: 25,
      hourlyQuota: 30,
      lastQuotaReset: now
    });

    const result = await checkAndUpdateQuota('user-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Hourly quota of 30 requests exceeded');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('should block request when daily limit (100) is exceeded', async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      dailyQuota: 100,
      hourlyQuota: 10,
      lastQuotaReset: now
    });

    const result = await checkAndUpdateQuota('user-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily quota of 100 requests exceeded');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('should reset counters upon crossing hourly time window', async () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000 * 2);
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      dailyQuota: 20,
      hourlyQuota: 30, // previously maxed out
      lastQuotaReset: oneHourAgo
    });

    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await checkAndUpdateQuota('user-1');
    expect(result.allowed).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'user-1' }),
        data: expect.objectContaining({
          dailyQuota: 21,
          hourlyQuota: 1 // reset to 1
        })
      })
    );
  });

  it('should retry and succeed when OCC conflict occurs on first attempt', async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      dailyQuota: 5,
      hourlyQuota: 2,
      lastQuotaReset: now
    });

    // First attempt fails CAS (count 0), second attempt succeeds (count 1)
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await checkAndUpdateQuota('user-1');
    expect(result.allowed).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('refundQuota should atomically decrement daily and hourly quota', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await refundQuota('user-1');

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-1',
          dailyQuota: { gt: 0 },
          hourlyQuota: { gt: 0 }
        }),
        data: expect.objectContaining({
          dailyQuota: { decrement: 1 },
          hourlyQuota: { decrement: 1 }
        })
      })
    );
  });
});
