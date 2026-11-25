import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getDb,
  getDbPath,
  createCheckin,
  createSession,
  completeSession,
  saveFeedback,
  saveJournalEntry,
  getDashboardData,
  deleteAllUserData,
  DEMO_USER_ID,
} from '../src/lib/db';

describe('File-based SQLite Database (./data/mindora.db)', () => {
  it('creates ./data/mindora.db and handles repository operations', () => {
    const dbPath = getDbPath();
    expect(dbPath).toBe(path.resolve(process.cwd(), 'data', 'mindora.db'));

    getDb();
    expect(fs.existsSync(dbPath)).toBe(true);

    // Test checkin
    const checkin = createCheckin({
      mood: 'Stressed',
      note: 'Testing physical file database persistence',
    });
    expect(checkin.id).toBeDefined();

    // Test session
    const session = createSession({
      activityId: 'physiological-sigh',
      checkinId: checkin.id,
    });
    expect(session.id).toBeDefined();

    // Test complete session
    const completed = completeSession(session.id);
    expect(completed.completed).toBe(true);

    // Test feedback
    const feedback = saveFeedback({
      sessionId: session.id,
      rating: 'yes',
    });
    expect(feedback.rating).toBe('yes');

    // Test journal entry
    const journal = saveJournalEntry({
      sessionId: session.id,
      prompt: 'How do you feel after the sigh?',
      text: 'Much better.',
    });
    expect(journal.text).toBe('Much better.');

    // Test dashboard data
    const dashboard = getDashboardData();
    expect(dashboard.user.id).toBe(DEMO_USER_ID);
    expect(dashboard.stats.totalSessions).toBeGreaterThanOrEqual(1);

    // Clean up test data
    deleteAllUserData(DEMO_USER_ID);
    const cleaned = getDashboardData();
    expect(cleaned.stats.totalSessions).toBe(0);
  });
});
