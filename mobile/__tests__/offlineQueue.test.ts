import { enqueuePhoto, getQueueStats, updateQueueItemStatus } from '@/services/offlineQueue';
import { getDatabase } from '@/services/database';
import { createRecord } from '@/services/recordRepository';

jest.mock('@/services/database', () => {
  const mockDb = {
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  };
  return {
    getDatabase: () => mockDb,
  };
});

jest.mock('@/services/recordRepository', () => ({
  createRecord: jest.fn().mockResolvedValue('mock-record-id-123'),
}));

describe('Offline Queue Manager', () => {
  let db: any;

  beforeEach(() => {
    db = getDatabase();
    jest.clearAllMocks();
  });

  describe('enqueuePhoto', () => {
    it('creates a record and a sync_queue entry', async () => {
      const recordId = await enqueuePhoto(
        'session-1',
        'file:///original.jpg',
        'file:///compressed.jpg'
      );

      // Verify createRecord was called with correct arguments
      expect(createRecord).toHaveBeenCalledWith(
        'session-1',
        'file:///original.jpg',
        'file:///compressed.jpg'
      );

      // Verify db.runAsync was called to insert into sync_queue
      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        ['mock-record-id-123']
      );

      // Verify it returns the new record ID
      expect(recordId).toBe('mock-record-id-123');
    });
  });

  describe('getQueueStats', () => {
    it('returns accurate pending counts and estimated size', async () => {
      db.getFirstAsync.mockResolvedValueOnce({ count: 5 });

      const stats = await getQueueStats();

      expect(db.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM sync_queue')
      );
      expect(stats.pendingCount).toBe(5);
      expect(stats.totalSizeKB).toBe(5 * 180); // 180KB estimate per item
    });

    it('returns 0 for empty queue', async () => {
      // Mock db returning undefined/null when no rows found
      db.getFirstAsync.mockResolvedValueOnce(null);

      const stats = await getQueueStats();

      expect(stats.pendingCount).toBe(0);
      expect(stats.totalSizeKB).toBe(0);
    });
  });

  describe('updateQueueItemStatus', () => {
    it('updates status and retry count when provided', async () => {
      await updateQueueItemStatus(42, 'failed', 3);

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue SET status = ?, retry_count = ?, last_attempt = ?'),
        ['failed', 3, expect.any(String), 42]
      );
    });

    it('updates status only when retry count is omitted', async () => {
      await updateQueueItemStatus(42, 'completed');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue SET status = ?, last_attempt = ?'),
        ['completed', expect.any(String), 42]
      );
    });
  });
});
