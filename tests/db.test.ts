import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import {
  initSchema,
  DEMO_USER_ID,
  createCheckin,
  createSession,
  completeSession,
  saveFeedback,
  saveJournalEntry,
  getRecentCheckins,
  getRecentSessions,
  getLatestFeedbackPerActivity,
  getDashboardData,
  deleteAllUserData,
  getCompletedActivityIdsInLast24Hours,
} from '../src/lib/db';
import { getAllActivities, getActivitiesByMood, getActivityById } from '../src/lib/catalog';
import { MOODS } from '../src/types';

describe('Activities Catalog', () => {
  it('should have 36 curated activities with quick and relief attributes', () => {
    const activities = getAllActivities();
    expect(activities).toHaveLength(36);
    for (const a of activities) {
      expect(typeof a.quick).toBe('boolean');
      expect(['calm', 'lift', 'both']).toContain(a.relief);
      expect(Object.keys(a.mood_fit || {}).length).toBeLessThanOrEqual(3);
    }
  });

  it('every mood must be targeted by at least 4 activities', () => {
    for (const mood of MOODS) {
      const targeting = getActivitiesByMood(mood);
      expect(targeting.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('should contain all required activity titles and reasonable durations', () => {
    const titles = getAllActivities().map((a) => a.title);
    expect(titles).toContain('Box Breathing');
    expect(titles).toContain('4-7-8 Breathing');
    expect(titles).toContain('Physiological Sigh');
    expect(titles).toContain('5-4-3-2-1 Grounding');
    expect(titles).toContain('Body Scan');
    expect(titles).toContain('Brain Dump');
    expect(titles).toContain('One Small Next Step');
    expect(titles).toContain('Gratitude Moment');
    expect(titles).toContain('Name What You Feel');
    expect(titles).toContain('Screen/Movement Break');
    expect(titles).toContain('Break It Into One Small Step');
    expect(titles).toContain('25-Minute Focus Sprint');
    expect(titles).toContain('Name the Worry, Then Park It');
    expect(titles).toContain('Reach Out to One Person');
    expect(titles).toContain('Sleep Wind-Down');
    expect(titles).toContain('Self-Kindness Pause');

    const box = getActivityById('box-breathing');
    expect(box?.duration_minutes).toBe(2);

    const sigh = getActivityById('physiological-sigh');
    expect(sigh?.duration_minutes).toBe(1);

    const screen = getActivityById('screen-movement-break');
    expect(screen?.duration_minutes).toBe(5);
  });
});

describe('Database & Repositories', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
  });

  afterAll(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('seeds the demo-user automatically', () => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID) as {
      id: string;
      created_at: string;
    };
    expect(user).toBeDefined();
    expect(user.id).toBe('demo-user');
  });

  it('creates checkin and retrieves it', () => {
    const checkin = createCheckin(
      {
        mood: 'Anxious',
        note: 'Feeling slightly overwhelmed with work deadlines.',
      },
      db
    );

    expect(checkin.id).toBeDefined();
    expect(checkin.user_id).toBe(DEMO_USER_ID);
    expect(checkin.mood).toBe('Anxious');
    expect(checkin.note).toBe('Feeling slightly overwhelmed with work deadlines.');

    const recents = getRecentCheckins(DEMO_USER_ID, 5, db);
    expect(recents.length).toBe(1);
    expect(recents[0].id).toBe(checkin.id);
  });

  it('truncates checkin notes to 300 characters', () => {
    const longNote = 'A'.repeat(350);
    const checkin = createCheckin({ mood: 'Stressed', note: longNote }, db);
    expect(checkin.note?.length).toBe(300);
  });

  it('creates session, completes it, and logs feedback and journal', () => {
    // 1. Create Checkin
    const checkin = createCheckin({ mood: 'Overwhelmed' }, db);

    // 2. Create Session
    const session = createSession(
      {
        activityId: 'box-breathing',
        checkinId: checkin.id,
      },
      db
    );
    expect(session.completed).toBe(false);
    expect(session.activity_id).toBe('box-breathing');

    // 3. Complete Session
    const completedSession = completeSession(session.id, DEMO_USER_ID, db);
    expect(completedSession.completed).toBe(true);
    expect(completedSession.completed_at).toBeDefined();

    // 4. Save Feedback
    const feedback = saveFeedback(
      {
        sessionId: session.id,
        rating: 'yes',
      },
      db
    );
    expect(feedback.rating).toBe('yes');

    // 5. Save Journal Entry
    const journal = saveJournalEntry(
      {
        sessionId: session.id,
        prompt: 'What did you notice?',
        text: 'Felt my shoulders drop significantly.',
      },
      db
    );
    expect(journal.text).toBe('Felt my shoulders drop significantly.');

    // 6. Verify Recent Sessions joins
    const recentSessions = getRecentSessions(DEMO_USER_ID, 5, db);
    expect(recentSessions).toHaveLength(1);
    expect(recentSessions[0].id).toBe(session.id);
    expect(recentSessions[0].activity?.title).toBe('Box Breathing');
    expect(recentSessions[0].feedback?.rating).toBe('yes');
    expect(recentSessions[0].journalEntry?.text).toBe('Felt my shoulders drop significantly.');
  });

  it('correctly tracks latest feedback per activity', () => {
    // Session 1 for box breathing with feedback 'a_little'
    const s1 = createSession({ activityId: 'box-breathing' }, db);
    saveFeedback({ sessionId: s1.id, rating: 'a_little' }, db);

    // Later session 2 for box breathing with feedback 'yes'
    const s2 = createSession({ activityId: 'box-breathing' }, db);
    saveFeedback({ sessionId: s2.id, rating: 'yes' }, db);

    // Session 3 for 4-7-8 breathing with feedback 'no'
    const s3 = createSession({ activityId: '4-7-8-breathing' }, db);
    saveFeedback({ sessionId: s3.id, rating: 'no' }, db);

    const latest = getLatestFeedbackPerActivity(DEMO_USER_ID, db);
    expect(latest).toHaveLength(2);

    const boxLatest = latest.find((l) => l.activity_id === 'box-breathing');
    expect(boxLatest?.rating).toBe('yes'); // most recent was 'yes'

    const fourSevenEightLatest = latest.find((l) => l.activity_id === '4-7-8-breathing');
    expect(fourSevenEightLatest?.rating).toBe('no');
  });

  it('tracks completed sessions in the last 24 hours', () => {
    const s1 = createSession({ activityId: 'box-breathing' }, db);
    completeSession(s1.id, DEMO_USER_ID, db);

    createSession({ activityId: 'body-scan' }, db);
    // Not completed

    const completed = getCompletedActivityIdsInLast24Hours(DEMO_USER_ID, db);
    expect(completed.has('box-breathing')).toBe(true);
    expect(completed.has('body-scan')).toBe(false);
  });

  it('computes dashboard data correctly', () => {
    createCheckin({ mood: 'Anxious' }, db);
    createCheckin({ mood: 'Anxious' }, db);
    createCheckin({ mood: 'Okay' }, db);

    const s1 = createSession({ activityId: 'box-breathing' }, db);
    completeSession(s1.id, DEMO_USER_ID, db);
    saveFeedback({ sessionId: s1.id, rating: 'yes' }, db);

    const s2 = createSession({ activityId: 'screen-movement-break' }, db);
    completeSession(s2.id, DEMO_USER_ID, db);

    const dashboard = getDashboardData(DEMO_USER_ID, db);
    expect(dashboard.user.id).toBe(DEMO_USER_ID);
    expect(dashboard.recentCheckins).toHaveLength(3);
    expect(dashboard.stats.totalSessions).toBe(2);
    expect(dashboard.stats.completedSessions).toBe(2);
    // box-breathing: 2 min, screen-movement-break: 5 min => total 7 min
    expect(dashboard.stats.totalMinutesPracticed).toBe(7);
    expect(dashboard.stats.completionRate).toBe(100);
    expect(dashboard.stats.moodCounts.Anxious).toBe(2);
    expect(dashboard.stats.moodCounts.Okay).toBe(1);
    expect(dashboard.stats.moodCounts.Sad).toBe(0);
    expect(dashboard.stats.activityTypeCounts.breathing).toBe(1);
    expect(dashboard.stats.activityTypeCounts.break).toBe(1);
  });

  it('deletes all user data while preserving demo user', () => {
    createCheckin({ mood: 'Sad' }, db);
    const session = createSession({ activityId: 'body-scan' }, db);
    completeSession(session.id, DEMO_USER_ID, db);
    saveFeedback({ sessionId: session.id, rating: 'yes' }, db);
    saveJournalEntry(
      {
        sessionId: session.id,
        prompt: 'test',
        text: 'test note',
      },
      db
    );

    deleteAllUserData(DEMO_USER_ID, db);

    const checkins = getRecentCheckins(DEMO_USER_ID, 10, db);
    expect(checkins).toHaveLength(0);

    const sessions = getRecentSessions(DEMO_USER_ID, 10, db);
    expect(sessions).toHaveLength(0);

    const dashboard = getDashboardData(DEMO_USER_ID, db);
    expect(dashboard.stats.totalSessions).toBe(0);
    expect(dashboard.stats.completedSessions).toBe(0);
    expect(dashboard.user.id).toBe(DEMO_USER_ID);
  });
});
