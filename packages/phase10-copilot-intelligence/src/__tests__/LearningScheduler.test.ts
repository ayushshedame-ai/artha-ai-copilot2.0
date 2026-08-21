/**
 * packages/phase10-copilot-intelligence/src/__tests__/LearningScheduler.test.ts
 * Artha AI — Phase 10 Learning Scheduler Tests
 */

import { LearningScheduler } from '../engine/LearningScheduler';
import { MarketHoursGuard } from '../guards/MarketHoursGuard';

describe('LearningScheduler', () => {
  const mockTraining = jest.fn().mockResolvedValue(undefined);

  test('does not trigger training when market is open', async () => {
    const mockGuard = {
      isMarketOpen: () => true
    } as any as MarketHoursGuard;

    const scheduler = new LearningScheduler(mockGuard, mockTraining);
    
    // Trigger check
    await (scheduler as any).checkAndSchedule();

    expect(mockTraining).not.toHaveBeenCalled();
    expect(scheduler.isTrainingActive()).toBe(false);
  });

  test('triggers training daily between 16:00 and 16:15 IST when market is closed', async () => {
    const mockGuard = {
      isMarketOpen: () => false
    } as any as MarketHoursGuard;

    const scheduler = new LearningScheduler(mockGuard, mockTraining);

    // Mock Date so Intl.DateTimeFormat in Asia/Kolkata returns hour: 16, minute: 5
    // 16:05 IST is 10:35 UTC
    const mockDate = new Date('2026-07-19T10:35:00.000Z');
    const originalDate = global.Date;
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDate;
      }
    } as any;

    try {
      await (scheduler as any).checkAndSchedule();
      expect(mockTraining).toHaveBeenCalled();
    } finally {
      global.Date = originalDate;
    }
  });

  test('does not trigger training at other times when market is closed', async () => {
    const mockGuard = {
      isMarketOpen: () => false
    } as any as MarketHoursGuard;

    const scheduler = new LearningScheduler(mockGuard, mockTraining);

    // Mock Date to 2:00 PM (14:00) IST -> 08:30 UTC
    const mockDate = new Date('2026-07-19T08:30:00.000Z');
    const originalDate = global.Date;
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDate;
      }
    } as any;

    try {
      mockTraining.mockClear();
      await (scheduler as any).checkAndSchedule();
      expect(mockTraining).not.toHaveBeenCalled();
    } finally {
      global.Date = originalDate;
    }
  });
});
