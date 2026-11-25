import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from './connection';
import { DEMO_USER_ID } from './schema';
import { getActivityById } from '../catalog';
import {
  Activity,
  ActivityType,
  Checkin,
  DashboardData,
  Feedback,
  JournalEntry,
  LatestActivityFeedback,
  Mood,
  Rating,
  Session,
  User,
} from '@/types';

// Raw SQLite row interfaces
interface CheckinRow {
  id: string;
  user_id: string;
  mood: string;
  note: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  checkin_id: string | null;
  activity_id: string;
  started_at: string;
  completed_at: string | null;
  completed: number;
}

interface FeedbackRow {
  id: string;
  user_id: string;
  session_id: string;
  rating: string;
  created_at: string;
}

interface JournalRow {
  id: string;
  user_id: string;
  session_id: string;
  prompt: string;
  text: string;
  created_at: string;
}

interface UserRow {
  id: string;
  created_at: string;
}

function mapCheckin(row: CheckinRow): Checkin {
  return {
    id: row.id,
    user_id: row.user_id,
    mood: row.mood as Mood,
    note: row.note,
    created_at: row.created_at,
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    checkin_id: row.checkin_id,
    activity_id: row.activity_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    completed: Boolean(row.completed),
  };
}

function mapFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    user_id: row.user_id,
    session_id: row.session_id,
    rating: row.rating as Rating,
    created_at: row.created_at,
  };
}

function mapJournal(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    session_id: row.session_id,
    prompt: row.prompt,
    text: row.text,
    created_at: row.created_at,
  };
}

/**
 * 1. createCheckin
 */
export function createCheckin(
  data: {
    userId?: string;
    mood: Mood;
    note?: string | null;
    id?: string;
    createdAt?: string;
  },
  dbInstance?: Database.Database
): Checkin {
  const db = dbInstance || getDb();
  const id = data.id || crypto.randomUUID();
  const userId = data.userId || DEMO_USER_ID;
  const createdAt = data.createdAt || new Date().toISOString();
  const note = data.note ? data.note.trim().slice(0, 300) : null;

  // Ensure user exists
  db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
    userId,
    new Date().toISOString()
  );

  const stmt = db.prepare(`
    INSERT INTO checkins (id, user_id, mood, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, data.mood, note, createdAt);

  return {
    id,
    user_id: userId,
    mood: data.mood,
    note,
    created_at: createdAt,
  };
}

/**
 * 2. createSession
 */
export function createSession(
  data: {
    userId?: string;
    checkinId?: string | null;
    activityId: string;
    id?: string;
    startedAt?: string;
  },
  dbInstance?: Database.Database
): Session {
  const db = dbInstance || getDb();
  const id = data.id || crypto.randomUUID();
  const userId = data.userId || DEMO_USER_ID;
  const startedAt = data.startedAt || new Date().toISOString();
  const checkinId = data.checkinId || null;

  // Ensure user exists
  db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
    userId,
    new Date().toISOString()
  );

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, checkin_id, activity_id, started_at, completed_at, completed)
    VALUES (?, ?, ?, ?, ?, NULL, 0)
  `);

  stmt.run(id, userId, checkinId, data.activityId, startedAt);

  return {
    id,
    user_id: userId,
    checkin_id: checkinId,
    activity_id: data.activityId,
    started_at: startedAt,
    completed_at: null,
    completed: false,
  };
}

/**
 * 3. completeSession
 */
export function completeSession(
  sessionId: string,
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): Session {
  const db = dbInstance || getDb();
  const completedAt = new Date().toISOString();

  const updateStmt = db.prepare(`
    UPDATE sessions
    SET completed = 1, completed_at = ?
    WHERE id = ? AND user_id = ?
  `);

  const result = updateStmt.run(completedAt, sessionId, userId);
  if (result.changes === 0) {
    throw new Error(`Session ${sessionId} not found for user ${userId}`);
  }

  const sessionRow = db
    .prepare(`SELECT * FROM sessions WHERE id = ? AND user_id = ?`)
    .get(sessionId, userId) as SessionRow | undefined;

  if (!sessionRow) {
    throw new Error(`Session ${sessionId} not found`);
  }

  return mapSession(sessionRow);
}

/**
 * 4. saveFeedback
 */
export function saveFeedback(
  data: {
    userId?: string;
    sessionId: string;
    rating: Rating;
    mood?: Mood;
    id?: string;
    createdAt?: string;
  },
  dbInstance?: Database.Database
): Feedback {
  const db = dbInstance || getDb();
  const id = data.id || crypto.randomUUID();
  const userId = data.userId || DEMO_USER_ID;
  const createdAt = data.createdAt || new Date().toISOString();

  // If mood is not passed explicitly, lookup checkin mood by joining session -> checkin
  let checkinMood: Mood | undefined = data.mood;
  if (!checkinMood) {
    const sessionRow = db
      .prepare(
        `SELECT c.mood FROM sessions s LEFT JOIN checkins c ON s.checkin_id = c.id WHERE s.id = ?`
      )
      .get(data.sessionId) as { mood?: string } | undefined;
    if (sessionRow?.mood) {
      checkinMood = sessionRow.mood as Mood;
    }
  }

  // Ensure user exists
  db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
    userId,
    new Date().toISOString()
  );

  const stmt = db.prepare(`
    INSERT INTO feedback (id, user_id, session_id, rating, mood, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, data.sessionId, data.rating, checkinMood || null, createdAt);

  return {
    id,
    user_id: userId,
    session_id: data.sessionId,
    rating: data.rating,
    mood: checkinMood || null,
    created_at: createdAt,
  };
}

/**
 * 5. saveJournalEntry
 */
export function saveJournalEntry(
  data: {
    userId?: string;
    sessionId: string;
    prompt: string;
    text: string;
    id?: string;
    createdAt?: string;
  },
  dbInstance?: Database.Database
): JournalEntry {
  const db = dbInstance || getDb();
  const id = data.id || crypto.randomUUID();
  const userId = data.userId || DEMO_USER_ID;
  const createdAt = data.createdAt || new Date().toISOString();

  // Ensure user exists
  db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
    userId,
    new Date().toISOString()
  );

  const stmt = db.prepare(`
    INSERT INTO journal_entries (id, user_id, session_id, prompt, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, data.sessionId, data.prompt, data.text, createdAt);

  return {
    id,
    user_id: userId,
    session_id: data.sessionId,
    prompt: data.prompt,
    text: data.text,
    created_at: createdAt,
  };
}

/**
 * 6. getRecentCheckins
 */
export function getRecentCheckins(
  userId: string = DEMO_USER_ID,
  limit: number = 10,
  dbInstance?: Database.Database
): Checkin[] {
  const db = dbInstance || getDb();
  const rows = db
    .prepare(
      `SELECT * FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit) as CheckinRow[];

  return rows.map(mapCheckin);
}

/**
 * 6b. getCheckinById
 */
export function getCheckinById(
  checkinId: string,
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): Checkin | null {
  const db = dbInstance || getDb();
  const row = db
    .prepare(`SELECT * FROM checkins WHERE id = ? AND user_id = ?`)
    .get(checkinId, userId) as CheckinRow | undefined;

  return row ? mapCheckin(row) : null;
}

/**
 * 7. getRecentSessions
 */
export function getRecentSessions(
  userId: string = DEMO_USER_ID,
  limit: number = 10,
  dbInstance?: Database.Database
): (Session & {
  activity?: Activity;
  feedback?: Feedback;
  journalEntry?: JournalEntry;
})[] {
  const db = dbInstance || getDb();
  const sessionRows = db
    .prepare(
      `SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?`
    )
    .all(userId, limit) as SessionRow[];

  return sessionRows.map((sRow) => {
    const session = mapSession(sRow);
    const activity = getActivityById(session.activity_id);

    const feedbackRow = db
      .prepare(`SELECT * FROM feedback WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(session.id) as FeedbackRow | undefined;

    const journalRow = db
      .prepare(`SELECT * FROM journal_entries WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(session.id) as JournalRow | undefined;

    return {
      ...session,
      activity,
      feedback: feedbackRow ? mapFeedback(feedbackRow) : undefined,
      journalEntry: journalRow ? mapJournal(journalRow) : undefined,
    };
  });
}

/**
 * 8. getLatestFeedbackPerActivity
 * Returns the most recent feedback per activity for scoring
 */
export function getLatestFeedbackPerActivity(
  userId: string = DEMO_USER_ID,
  currentMoodOrDb?: Mood | Database.Database | null,
  dbInstance?: Database.Database
): LatestActivityFeedback[] {
  let currentMood: Mood | undefined = undefined;
  let db: Database.Database;

  if (currentMoodOrDb && typeof (currentMoodOrDb as unknown as { prepare?: unknown }).prepare === 'function') {
    db = currentMoodOrDb as unknown as Database.Database;
    currentMood = undefined;
  } else {
    currentMood = (currentMoodOrDb as Mood) || undefined;
    db = dbInstance || getDb();
  }

  // Join feedback with sessions to obtain the activity_id for each feedback, and join checkins for mood
  const rows = db
    .prepare(
      `
      SELECT f.id, f.session_id, f.rating, f.created_at, s.activity_id, COALESCE(f.mood, c.mood) as mood
      FROM feedback f
      INNER JOIN sessions s ON f.session_id = s.id
      LEFT JOIN checkins c ON s.checkin_id = c.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC, f.rowid DESC
    `
    )
    .all(userId) as {
    id: string;
    session_id: string;
    rating: string;
    created_at: string;
    activity_id: string;
    mood: string | null;
  }[];

  // Group by activity_id
  const byActivity = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byActivity.has(row.activity_id)) {
      byActivity.set(row.activity_id, []);
    }
    byActivity.get(row.activity_id)!.push(row);
  }

  const latest: LatestActivityFeedback[] = [];

  for (const [activityId, actRows] of byActivity.entries()) {
    if (currentMood) {
      // Prefer feedback given under the same mood
      const sameMoodRow = actRows.find((r) => r.mood === currentMood);
      if (sameMoodRow) {
        latest.push({
          activity_id: activityId,
          rating: sameMoodRow.rating as Rating,
          mood: sameMoodRow.mood as Mood,
          weight: 1.0,
          created_at: sameMoodRow.created_at,
          session_id: sameMoodRow.session_id,
        });
        continue;
      }

      // If no feedback under currentMood, take the most recent feedback at half weight (0.5)
      const diffMoodRow = actRows[0];
      latest.push({
        activity_id: activityId,
        rating: diffMoodRow.rating as Rating,
        mood: diffMoodRow.mood as Mood,
        weight: 0.5,
        created_at: diffMoodRow.created_at,
        session_id: diffMoodRow.session_id,
      });
    } else {
      const recentRow = actRows[0];
      latest.push({
        activity_id: activityId,
        rating: recentRow.rating as Rating,
        mood: recentRow.mood as Mood,
        weight: 1.0,
        created_at: recentRow.created_at,
        session_id: recentRow.session_id,
      });
    }
  }

  return latest;
}

/**
 * Helper: get completed activity IDs in the last 24 hours (for penalty calculation)
 */
export function getCompletedActivityIdsInLast24Hours(
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): Set<string> {
  const db = dbInstance || getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = db
    .prepare(
      `
      SELECT DISTINCT activity_id
      FROM sessions
      WHERE user_id = ? AND completed = 1 AND completed_at >= ?
    `
    )
    .all(userId, twentyFourHoursAgo) as { activity_id: string }[];

  return new Set(rows.map((r) => r.activity_id));
}

/**
 * Helper: get total completed counts per activity_id for the user (no personal text)
 */
export function getActivityCompletionCounts(
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): Record<string, number> {
  const db = dbInstance || getDb();
  const rows = db
    .prepare(
      `
      SELECT activity_id, COUNT(*) as count
      FROM sessions
      WHERE user_id = ? AND completed = 1
      GROUP BY activity_id
    `
    )
    .all(userId) as { activity_id: string; count: number }[];

  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.activity_id] = Number(r.count) || 0;
  }
  return counts;
}

/**
 * 9. getDashboardData
 */
export function getDashboardData(
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): DashboardData {
  const db = dbInstance || getDb();

  // Ensure user exists
  db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
    userId,
    new Date().toISOString()
  );

  const userRow = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(userId) as UserRow;

  const user: User = {
    id: userRow.id,
    created_at: userRow.created_at,
  };

  const recentCheckins = getRecentCheckins(userId, 15, db);
  const recentSessions = getRecentSessions(userId, 15, db);

  // Total session stats
  const totalSessionsRow = db
    .prepare(`SELECT COUNT(*) as count FROM sessions WHERE user_id = ?`)
    .get(userId) as { count: number };
  const totalSessions = totalSessionsRow?.count || 0;

  const completedSessionsRow = db
    .prepare(`SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND completed = 1`)
    .get(userId) as { count: number };
  const completedSessions = completedSessionsRow?.count || 0;

  // Calculate total minutes practiced across all completed sessions
  const allCompletedSessions = db
    .prepare(`SELECT activity_id FROM sessions WHERE user_id = ? AND completed = 1`)
    .all(userId) as { activity_id: string }[];

  let totalMinutesPracticed = 0;
  for (const s of allCompletedSessions) {
    const act = getActivityById(s.activity_id);
    totalMinutesPracticed += act?.duration_minutes || 2;
  }

  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Mood counts
  const moodCounts: Record<Mood, number> = {
    Anxious: 0,
    Stressed: 0,
    Sad: 0,
    Overwhelmed: 0,
    Okay: 0,
  };

  const checkinMoodRows = db
    .prepare(
      `SELECT mood, COUNT(*) as count FROM checkins WHERE user_id = ? GROUP BY mood`
    )
    .all(userId) as { mood: string; count: number }[];

  for (const row of checkinMoodRows) {
    if (row.mood in moodCounts) {
      moodCounts[row.mood as Mood] = row.count;
    }
  }

  // Activity type counts
  const activityTypeCounts: Record<ActivityType, number> = {
    breathing: 0,
    grounding: 0,
    journaling: 0,
    break: 0,
  };

  const sessionActivities = db
    .prepare(`SELECT activity_id FROM sessions WHERE user_id = ?`)
    .all(userId) as { activity_id: string }[];

  for (const s of sessionActivities) {
    const act = getActivityById(s.activity_id);
    if (act && act.type in activityTypeCounts) {
      activityTypeCounts[act.type]++;
    }
  }

  return {
    user,
    recentCheckins,
    recentSessions,
    stats: {
      totalSessions,
      completedSessions,
      totalMinutesPracticed,
      completionRate,
      moodCounts,
      activityTypeCounts,
    },
  };
}

/**
 * 10. deleteAllUserData
 * Removes all checkins, sessions, feedback, and journal entries for the user.
 * Preserves the user record (or re-seeds) so foreign keys work.
 */
export function deleteAllUserData(
  userId: string = DEMO_USER_ID,
  dbInstance?: Database.Database
): void {
  const db = dbInstance || getDb();

  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM journal_entries WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM feedback WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM checkins WHERE user_id = ?`).run(userId);
    // Keep user row so subsequent writes have a valid user_id
    db.prepare(`INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)`).run(
      userId,
      new Date().toISOString()
    );
  });

  transaction();
}
