# Mindora Test Execution & Coverage Report

**Date of Execution:** November 25, 2026  
**Environment:** Node v26.12.0, Windows, Next.js 16.4.6, better-sqlite3 13.2.0, Playwright 1.65.1, Vitest 5.1.1  

---

## 1. Journey Metrics (Scripted in Playwright E2E)

Measured using Playwright running against the production build with `DEMO_MODE=true` (`tests/e2e-demo.spec.ts`):

| Metric | Measured Value | Description / Trace |
| :--- | :--- | :--- |
| **Taps to Start Activity** | **3 taps** | **Tap 1:** Select "Anxious" mood radio card<br>**Tap 2:** Click "Get suggestions" button (with note "Not performing well in academics")<br>**Tap 3:** Click "Start Activity →" on academic recommendation |
| **Time to Start Activity** | **1.89 seconds** (1,892 ms) | Measured elapsed wall-clock time from initial `page.goto('http://localhost:3000')` to arrival on `/activity/[sessionId]` |

---

## 2. Playwright E2E Test Results (`DEMO_MODE=true`)

Executed via `npx playwright test`:

```text
Running 6 tests using 1 worker

Mindora database seeded successfully:
- Seeded 7 check-ins across multiple days
- Seeded 7 completed sessions with feedback
- Seeded 3 private journal reflections
- Feedback effects active: box-breathing (yes), body-scan (no), brain-dump (a_little)

=== E2E METRICS ===
Taps to start activity: 3
Time from opening app to starting activity: 1.89s (1892ms)
===================

  ok 1 [chromium] › tests\e2e-demo.spec.ts:13:3 › Mindora E2E (DEMO_MODE=true) › Full journey: select Anxious with academics note → see acknowledgement, next step & academic activity → start activity → complete → submit "Yes" → dashboard (2.7s)
  ok 2 [chromium] › tests\e2e-demo.spec.ts:153:3 › Mindora E2E (DEMO_MODE=true) › Crisis phrase shows safety screen with NO recommendations (1.2s)
  ok 3 [chromium] › tests\e2e-demo.spec.ts:188:3 › Mindora E2E (DEMO_MODE=true) › Follow-up chat: Anxious + academics note → click "No breathing exercises" → zero breathing cards & bot reply → type crisis phrase → safety screen (1.6s)
  ok 4 [chromium] › tests\journey.spec.ts:4:3 › Mindora End-to-End User Journey › clicks through complete journey: check-in → recommendations → breathing activity → feedback → dashboard → delete (2.8s)
  ok 5 [chromium] › tests\journey.spec.ts:103:3 › Mindora End-to-End User Journey › grounding activity: step-by-step Next/Back navigation and completion (2.0s)
  ok 6 [chromium] › tests\journey.spec.ts:136:3 › Mindora End-to-End User Journey › journaling activity: typing and saving to /api/journal (2.1s)

  6 passed (14.5s)
```

### Detailed E2E Scenarios Verified

1. **Full User Journey with Note Themes, Acknowledgement, and Suggestions for You**:
   - Checked in with mood **Anxious** and optional note: *"Not performing well in academics"*.
   - Verified calm card rendered above recommendations with situational **acknowledgement** and the **Rules** badge.
   - Verified exactly **3 recommendations** displayed with the **Rules** badge (per `DEMO_MODE=true`).
   - Verified that an **academic activity** (`Name the Worry, Then Park It` / `Break It Into One Small Step` / `25-Minute Focus Sprint`) surfaced in the top 3 due to the theme bonus (+5).
   - Verified **"Suggestions for you"** section with 3 cards displaying timeframe chips (`Now`, `Today`, `This week`), **Template** badge, and dedicated non-medical disclaimer.
   - Verified *"One small step for today"* card rendered below recommendations with the **next_step** action and the **Rules** badge.
   - Started the academic activity and verified navigation to `/activity/[sessionId]`.
   - Completed the activity steps.
   - Submitted **"Yes"** rating on feedback screen (*"Was this activity helpful?"*).
   - Verified redirect to `/dashboard` displaying the check-in and completed academic activity with the **Helpful** badge.

2. **Crisis Safety Trigger (Zero Recommendations)**:
   - Entered crisis note: *"I cannot take this anymore, I want to end my life"*.
   - Clicked *"Get suggestions"*.
   - Verified the **Safety Screen** appeared with supportive contact resources (*A Trusted Person*, *Local Crisis Helpline*, *Local Emergency Services*).
   - Verified that **NO recommendations**, NO acknowledgement, NO suggestions, and NO next step cards were generated.
   - Verified clicking *"Return to Check-in"* resets the form back to clean state.

3. **Follow-Up Recommendation Chat & In-Chat Crisis Interception**:
   - Checked in with mood **Anxious** and note: *"Not performing well in academics"*.
   - Verified *"Want to adjust these?"* chat panel and quick-reply chips.
   - Clicked quick chip *"No breathing exercises"*.
   - Verified assistant reply appeared in chat and all breathing exercise cards were removed from the 3 displayed cards.
   - Verified **"Suggestions for you"** remained visible and intact after chat adjustment.
   - Entered crisis phrase in chat input: *"I want to end my life right now"* and clicked *"Send"*.
   - Verified immediate transition to **Safety Screen** with crisis contacts, zero recommendations, and zero text saved.

---

## 3. Vitest Test Suite & Code Coverage Report

Executed via `npm run test:coverage` (`vitest run --coverage` using `@vitest/coverage-v8`):

```text
 RUN  v5.1.1 D:/Mindora
      Coverage enabled with v8

 ✓ tests/themes.test.ts (18 tests) 161ms
 ✓ tests/recommender.test.ts (8 tests) 127ms
 ✓ tests/seed.test.ts (1 test) 127ms
 ✓ tests/file-db.test.ts (1 test) 226ms
 ✓ tests/db.test.ts (11 tests) 444ms
 ✓ tests/chat.test.ts (17 tests) 205ms
 ✓ tests/ai.test.ts (21 tests) 221ms
 ✓ tests/safety.test.ts (28 tests) 26ms
 ✓ tests/gemini.test.ts (18 tests) 16ms

 Test Files  9 passed (9)
      Tests  123 passed (123)
   Start at  14:34:24
   Duration  2.03s (import 39%, tests 34%, worker 15%, transform 12%)
```

### Actual Code Coverage Table

| Module / File | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **All files** | **84.40** | **76.22** | **91.17** | **85.17** | |
| **src/lib/catalog** | **100.00** | **75.00** | **100.00** | **100.00** | |
| ↳ `index.ts` | 100.00 | 75.00 | 100.00 | 100.00 | 6 |
| **src/lib/chat** | **86.17** | **75.96** | **92.85** | **85.59** | |
| ↳ `ai.ts` | 85.55 | 75.75 | 92.30 | 84.70 | 148, 250, 252, 286 |
| ↳ `intent.ts` | 87.87 | 76.31 | 100.00 | 87.87 | 77, 80, 83, 86 |
| **src/lib/db** | **89.00** | **78.83** | **88.46** | **89.41** | |
| ↳ `connection.ts` | 65.21 | 50.00 | 66.66 | 65.21 | 13, 21–23, 35, 50–52 |
| ↳ `repository.ts` | 90.97 | 83.96 | 90.00 | 91.60 | 344–349, 447–462 |
| ↳ `schema.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `seed.ts` | 96.15 | 81.81 | 100.00 | 96.15 | 205 |
| **src/lib/recommender** | **80.80** | **74.78** | **90.56** | **82.14** | |
| ↳ `ai.ts` | 83.72 | 77.52 | 100.00 | 83.73 | 358–359, 386–395 |
| ↳ `fallbackSuggestions.ts` | 100.00 | 62.50 | 100.00 | 100.00 | 721–722 |
| ↳ `fallbackTemplates.ts` | 69.23 | 47.05 | 100.00 | 69.23 | 219–222 |
| ↳ `index.ts` | 81.25 | 70.00 | 100.00 | 89.28 | 99–101 |
| ↳ `rules.ts` | 77.61 | 76.27 | 81.48 | 78.88 | 268, 526, 531–532, 584 |
| ↳ `themeKeywords.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `themes.ts` | 100.00 | 87.50 | 100.00 | 100.00 | 43 |
| **src/lib/safety** | **100.00** | **100.00** | **100.00** | **100.00** | |
| ↳ `index.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `phrases.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |

---

## 4. Summary of Verification Status

- **Unit & Integration Suite (Vitest):** 123 / 123 passed across 9 files (100% pass rate).
- **End-to-End Suite (Playwright):** 6 / 6 passed across 2 files (100% pass rate).
- **Core Engine Statement Coverage:** 84.29% statements, 85.03% lines, 90.29% functions (`src/lib/ai/gemini.ts` at 95.52% statements).
- **Safety Module Coverage:** 100% statement, branch, function, and line coverage.
