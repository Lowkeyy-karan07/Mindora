# Mindora Test Execution & Coverage Report

**Date of Execution:** November 25, 2026  
**Environment:** Node v20.20.2 (pinned `20.18.0` / `20.x`), Windows, Next.js 16.4.6, better-sqlite3 11.10.0, Playwright 1.65.1, Vitest 5.1.1

---

## 1. Journey Metrics (Scripted in Playwright E2E)

Measured using Playwright running against `npm run start` (`NODE_ENV=production`) with `DEMO_MODE=true` (`tests/e2e-demo.spec.ts`):

| Metric | Measured Value | Description / Trace |
| :--- | :--- | :--- |
| **Taps to Start Activity** | **3 taps** | **Tap 1:** Select "Anxious" mood radio card<br>**Tap 2:** Click "Get suggestions" button (with note `"Not performing well in academics"`)<br>**Tap 3:** Click `"Start now"` on the `Right now` card |
| **Time to Start Activity** | **1.18 seconds** (1,178 ms) | Measured elapsed wall-clock time from initial `page.goto('http://localhost:3000')` to arrival on `/activity/[sessionId]` |

---

## 2. Playwright E2E Test Results (`DEMO_MODE=true`)

Executed via `npm run test:e2e`:

```text
Running 6 tests using 1 worker

=== E2E METRICS ===
Taps to start activity: 3
Time from opening app to starting activity: 1.18s (1178ms)
===================

  ok 1 [chromium] › tests\e2e-demo.spec.ts:13:3 › Full journey: Anxious + academics note -> ordered plan -> Start now in 1 tap -> feedback returns with Done & Next highlighted -> Later today shows 3 steps -> Dashboard (2.2s)
  ok 2 [chromium] › tests\e2e-demo.spec.ts:153:3 › Crisis phrase shows safety screen with NO plan or recommendations (632ms)
  ok 3 [chromium] › tests\e2e-demo.spec.ts:177:3 › Follow-up chat: Anxious + academics note -> "No breathing exercises" removes breathing from Right now and Next without changing Situation or Later -> crisis phrase triggers Safety Screen (1.0s)
  ok 4 [chromium] › tests\journey.spec.ts:4:3 › clicks through complete journey: check-in → recommendations → breathing activity → feedback → dashboard → delete (1.6s)
  ok 5 [chromium] › tests\journey.spec.ts:110:3 › grounding activity: step-by-step Next/Back navigation and completion (1.2s)
  ok 6 [chromium] › tests\journey.spec.ts:143:3 › journaling activity: typing and saving to /api/journal (632ms)

  6 passed (11.8s)
```

---

## 3. Vitest Test Suite & Code Coverage Report

Executed via `npm run test:coverage` (`vitest run --coverage` using `@vitest/coverage-v8`):

```text
 RUN  v5.1.1 D:/Mindora
      Coverage enabled with v8

 ✓ tests/recommender.test.ts (8 tests) 88ms
 ✓ tests/file-db.test.ts (1 test) 53ms
 ✓ tests/themes.test.ts (18 tests) 174ms
 ✓ tests/db.test.ts (11 tests) 110ms
 ✓ tests/chat.test.ts (18 tests) 215ms
 ✓ tests/safety.test.ts (28 tests) 27ms
 ✓ tests/gemini.test.ts (23 tests) 39ms
 ✓ tests/seed.test.ts (1 test) 48ms
 ✓ tests/ai.test.ts (14 tests) 434ms
 ✓ tests/plan.test.ts (18 tests) 195ms

 Test Files  10 passed (10)
      Tests  140 passed (140)
   Duration  1.92s
```

### Actual Code Coverage Table

| Module / File | % Stmts | % Branch | % Funcs | % Lines |
| :--- | :---: | :---: | :---: | :---: |
| **All files** | **85.12** | **75.84** | **86.32** | **86.46** |
| **src/lib/ai/gemini.ts** | **96.62** | **89.81** | **100.00** | **96.55** |
| **src/lib/catalog/index.ts** | **100.00** | **75.00** | **100.00** | **100.00** |
| **src/lib/chat** | **82.53** | **75.00** | **85.71** | **81.96** |
| **src/lib/db** | **86.40** | **75.15** | **88.88** | **86.76** |
| **src/lib/recommender** | **83.73** | **74.36** | **84.21** | **85.71** |
| ↳ `plan.ts` | 89.20 | 76.09 | 85.36 | 90.84 |
| ↳ `fallbackTemplates.ts` | 100.00 | 85.71 | 100.00 | 100.00 |
| ↳ `themeKeywords.ts` / `themes.ts` | 100.00 | 90.00–100.00 | 100.00 | 100.00 |
| **src/lib/safety** | **100.00** | **100.00** | **100.00** | **100.00** |

---

## 4. Live AI vs Honest Rules Evaluation (`npm run compare:ai`)

Evaluated across 10 diverse check-ins (including unpredictable and ambiguous notes) comparing live Gemini vs `DEMO_MODE=true` Honest Rules Mode:

- **Default `.env.local` model (`gemini-3.5-flash-lite`):** `1/10` live AI calls succeeded (`Okay + ""`); `9/10` encountered transient upstream `503 UNAVAILABLE` (*"This model is currently experiencing high demand"*), triggering clean rules fallback without errors.
- **`gemini-flash-lite-latest` run:** `2/10` live AI calls succeeded before upstream `503` bursts on the remaining calls:
  - **`Anxious + "3am can't sleep exam tomorrow"`**:
    - *AI Avoid List:* `studying, caffeine, screens, new tasks, focus sprint`.
    - *AI:* `now = Physiological Sigh`, `next = Name the Worry, Then Park It | Pick Your Conversation Moment`, `step #1 = Close your eyes — Turn away from all screens, put your phone face down, and let your body rest flat in bed.`
    - *Rules (Honest Sleep Match):* `now = 4-7-8 Breathing`, `next = Sleep Wind-Down | Name the Worry, Then Park It`, `step #1 = Place phone across room`. Neither mode suggested study sprints at 3am.
  - **`Anxious + "I have a job interview in an hour"`**:
    - *AI (`interpreted=true`):* returned `Physiological Sigh` (`now`), `5-4-3-2-1 Grounding` (`next[0]`), and `what_not_to_suggest: [starting new projects, long journaling, cramming information]` (code guard swapped out AI's `journaling` `next[1]` choice cleanly).
    - *Rules (`interpreted=false`):* honestly reported `Turn on AI mode to get suggestions based on your note.` with mood-based calming steps instead of an unrelated workplace-inbox template.
  - **Unmatched notes in Rules Mode (`"my phone broke and my trip is tomorrow"`, `"my pet is sick"`, `"tired"`):** All honestly returned `interpreted=false` with `"Turn on AI mode to get suggestions based on your note."` and avoided unrelated `money`/`health_worry`/`sleep` templates.
  - **Matched High-Confidence Rules (`"argued with my dad tonight"`, `"Not performing well in academics"`, `"I miss my friends..."`, `"Money is tight..."`):** Matched `conflict`, `exam`, `loneliness`, and `money` accurately without cross-topic leaks.

---

## 5. Summary of Verification Status

- **Production Build (`npm run build`):** Exited `0` (TypeScript + Turbopack clean).
- **Unit & Integration Suite (`npm test` / `npm run test:coverage`):** 140 / 140 passed across 10 files (100% pass rate).
- **End-to-End Suite (`npm run test:e2e`):** 6 / 6 passed across 2 files (100% pass rate).
- **Safety Module Coverage:** 100% statement, branch, function, and line coverage.
