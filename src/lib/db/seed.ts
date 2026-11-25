import type Database from 'better-sqlite3';
import { getDb } from './connection';
import { DEMO_USER_ID, initSchema } from './schema';

/**
 * Idempotent database seeder for Mindora.
 * Uses deterministic IDs so repeatedly running `npm run seed` does NOT create duplicates.
 * Seeds realistic check-ins, completed sessions, and feedback across several days.
 */
export function seedDatabase(customDb?: Database.Database): void {
  const db = customDb || getDb();
  initSchema(db);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  // 1. Ensure demo-user exists
  db.prepare(`
    INSERT OR REPLACE INTO users (id, created_at)
    VALUES (?, ?)
  `).run(DEMO_USER_ID, new Date(now - 7 * dayMs).toISOString());

  // 2. Demo Seed Data across 5 days
  const seedItems = [
    {
      checkinId: 'seed-checkin-1',
      mood: 'Stressed',
      note: 'Busy start to the week, feeling pressure from multiple project deadlines.',
      checkinTime: new Date(now - 4 * dayMs - 2 * hourMs).toISOString(),
      sessionId: 'seed-session-1',
      activityId: 'box-breathing',
      sessionStartTime: new Date(now - 4 * dayMs - 1 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 4 * dayMs - 58 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-1',
      rating: 'yes',
      journalId: null,
      journalPrompt: null,
      journalText: null,
    },
    {
      checkinId: 'seed-checkin-2',
      mood: 'Anxious',
      note: 'Butterflies in my stomach before the team quarterly review.',
      checkinTime: new Date(now - 3 * dayMs - 4 * hourMs).toISOString(),
      sessionId: 'seed-session-2',
      activityId: '5-4-3-2-1-grounding',
      sessionStartTime: new Date(now - 3 * dayMs - 3 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 3 * dayMs - 2 * hourMs - 57 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-2',
      rating: 'yes',
      journalId: 'seed-journal-1',
      journalPrompt: 'Notice how your body feels after connecting with your senses.',
      journalText: 'My racing heartbeat slowed down significantly once I focused on 5 physical objects around me.',
    },
    {
      checkinId: 'seed-checkin-3',
      mood: 'Overwhelmed',
      note: 'Too many open browser tabs, messages, and conflicting task priorities.',
      checkinTime: new Date(now - 2 * dayMs - 5 * hourMs).toISOString(),
      sessionId: 'seed-session-3',
      activityId: 'brain-dump',
      sessionStartTime: new Date(now - 2 * dayMs - 4 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 2 * dayMs - 4 * hourMs + 3 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-3',
      rating: 'a_little',
      journalId: 'seed-journal-2',
      journalPrompt: 'Empty your mental clutter onto the page without editing.',
      journalText: 'Wrote down 8 pending tasks. Decided to focus on just the client report first and ignore the rest.',
    },
    {
      checkinId: 'seed-checkin-4',
      mood: 'Sad',
      note: 'Feeling drained, low energy, and slightly discouraged today.',
      checkinTime: new Date(now - 1 * dayMs - 6 * hourMs).toISOString(),
      sessionId: 'seed-session-4',
      activityId: 'body-scan',
      sessionStartTime: new Date(now - 1 * dayMs - 5 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 1 * dayMs - 5 * hourMs + 3 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-4',
      rating: 'no', // Demonstrates negative feedback demotion
      journalId: null,
      journalPrompt: null,
      journalText: null,
    },
    {
      checkinId: 'seed-checkin-5',
      mood: 'Overwhelmed',
      note: 'Need a physical pause away from the desk and glare.',
      checkinTime: new Date(now - 1 * dayMs - 2 * hourMs).toISOString(),
      sessionId: 'seed-session-5',
      activityId: 'screen-movement-break',
      sessionStartTime: new Date(now - 1 * dayMs - 1 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 1 * dayMs - 1 * hourMs + 5 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-5',
      rating: 'yes',
      journalId: null,
      journalPrompt: null,
      journalText: null,
    },
    {
      checkinId: 'seed-checkin-6',
      mood: 'Stressed',
      note: 'Tightness in neck and shoulders before midday calls.',
      checkinTime: new Date(now - 4 * hourMs).toISOString(),
      sessionId: 'seed-session-6',
      activityId: 'physiological-sigh',
      sessionStartTime: new Date(now - 3 * hourMs).toISOString(),
      sessionEndTime: new Date(now - 3 * hourMs + 1 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-6',
      rating: 'yes',
      journalId: null,
      journalPrompt: null,
      journalText: null,
    },
    {
      checkinId: 'seed-checkin-7',
      mood: 'Okay',
      note: 'Feeling relatively balanced and present, wanting to maintain this clear focus.',
      checkinTime: new Date(now - 1 * hourMs).toISOString(),
      sessionId: 'seed-session-7',
      activityId: 'gratitude-moment',
      sessionStartTime: new Date(now - 45 * 60 * 1000).toISOString(),
      sessionEndTime: new Date(now - 43 * 60 * 1000).toISOString(),
      feedbackId: 'seed-feedback-7',
      rating: 'yes',
      journalId: 'seed-journal-3',
      journalPrompt: 'Notice 2 or 3 tiny things that brought ease to your day.',
      journalText: 'Grateful for morning sunshine through the window, warm herbal tea, and a quiet moment.',
    },
  ];

  const insertCheckin = db.prepare(`
    INSERT OR REPLACE INTO checkins (id, user_id, mood, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, checkin_id, activity_id, started_at, completed_at, completed)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const insertFeedback = db.prepare(`
    INSERT OR REPLACE INTO feedback (id, user_id, session_id, rating, mood, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertJournal = db.prepare(`
    INSERT OR REPLACE INTO journal_entries (id, user_id, session_id, prompt, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const item of seedItems) {
      insertCheckin.run(
        item.checkinId,
        DEMO_USER_ID,
        item.mood,
        item.note,
        item.checkinTime
      );

      insertSession.run(
        item.sessionId,
        DEMO_USER_ID,
        item.checkinId,
        item.activityId,
        item.sessionStartTime,
        item.sessionEndTime
      );

      insertFeedback.run(
        item.feedbackId,
        DEMO_USER_ID,
        item.sessionId,
        item.rating,
        item.mood,
        item.sessionEndTime
      );

      if (item.journalId && item.journalPrompt && item.journalText) {
        insertJournal.run(
          item.journalId,
          DEMO_USER_ID,
          item.sessionId,
          item.journalPrompt,
          item.journalText,
          item.sessionEndTime
        );
      }
    }
  });

  transaction();

  console.log('Mindora database seeded successfully:');
  console.log(`- Seeded ${seedItems.length} check-ins across multiple days`);
  console.log(`- Seeded ${seedItems.length} completed sessions with feedback`);
  console.log('- Seeded 3 private journal reflections');
  console.log('- Feedback effects active: box-breathing (yes), body-scan (no), brain-dump (a_little)');
}

// If executed directly via CLI
if (require.main === module || process.argv[1]?.includes('seed')) {
  seedDatabase();
}
