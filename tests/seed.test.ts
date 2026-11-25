import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedDatabase } from '../src/lib/db/seed';
import { initSchema, DEMO_USER_ID, getDashboardData, getLatestFeedbackPerActivity } from '../src/lib/db';

describe('Database Seed Script (idempotency & feedback effects)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('seeds database idempotently without duplicating rows on repeated runs', () => {
    // 1st run
    seedDatabase(db);
    const dashboardAfterRun1 = getDashboardData(DEMO_USER_ID, db);

    expect(dashboardAfterRun1.stats.completedSessions).toBe(7);
    expect(dashboardAfterRun1.recentCheckins.length).toBe(7);
    expect(dashboardAfterRun1.stats.totalMinutesPracticed).toBeGreaterThan(0);

    // 2nd run
    seedDatabase(db);
    const dashboardAfterRun2 = getDashboardData(DEMO_USER_ID, db);

    // Counts must remain exactly identical
    expect(dashboardAfterRun2.stats.completedSessions).toBe(7);
    expect(dashboardAfterRun2.recentCheckins.length).toBe(7);
    expect(dashboardAfterRun2.stats.totalMinutesPracticed).toBe(
      dashboardAfterRun1.stats.totalMinutesPracticed
    );

    // Verify feedback effects are active
    const latestFeedback = getLatestFeedbackPerActivity(DEMO_USER_ID, db);
    const boxFeedback = latestFeedback.find((f) => f.activity_id === 'box-breathing');
    const bodyScanFeedback = latestFeedback.find((f) => f.activity_id === 'body-scan');
    const brainDumpFeedback = latestFeedback.find((f) => f.activity_id === 'brain-dump');

    expect(boxFeedback?.rating).toBe('yes');
    expect(bodyScanFeedback?.rating).toBe('no');
    expect(brainDumpFeedback?.rating).toBe('a_little');
  });
});
