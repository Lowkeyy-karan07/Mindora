# Mindora — Test Report

## 1. Tools Used

- **Vitest (v5.1.1)** with `@vitest/coverage-v8`: Executes unit and integration test suites, validating the SQLite database repository, safety keyword matching, extensible situation theme detection, rules-based activity scoring, and mocked Gemini AI recommendation flows.
- **Playwright (v1.65.1)** with Chromium: Executes browser-level end-to-end (E2E) integration tests against the Next.js production build (`DEMO_MODE=true`), validating UI workflows, note theme surfacing, multi-modal activity players, feedback collection, dashboard updates, and journey timing.

---

## 2. Test Cases Mapped to SRS Functional Requirements

| FR ID | Requirement | Test File | Test Cases / Scenarios | Tool |
| :--- | :--- | :--- | :--- | :--- |
| **FR-1** | Mood Check-in & Input Validation | `tests/db.test.ts`<br>`tests/journey.spec.ts` | • `creates checkin and persists to DB`<br>• `retrieves recent checkins in desc order`<br>• Select 5 mood options, enter note ($\le 300$ chars), submit check-in | Vitest<br>Playwright |
| **FR-2** | Phrase-Based Crisis Interception | `tests/safety.test.ts`<br>`tests/e2e-demo.spec.ts` | • 8 crisis phrases MUST trigger (`"i want to end my life"`, `"suicide"`, etc.)<br>• 8 ordinary phrases MUST NOT trigger (`"deadline is killing me"`, `"back hurts"`, etc.)<br>• Normalization, whitespace, and punctuation tests<br>• E2E: Note with crisis phrase renders Safety Screen and generates 0 recommendations | Vitest<br>Playwright |
| **FR-3** | Hybrid Activity Recommendation Engine | `tests/recommender.test.ts`<br>`tests/ai.test.ts`<br>`tests/e2e-demo.spec.ts` | • Returns exactly 3 recommendations with reasons<br>• Weighted mood fit (3 = primary, 2 = good, 1 = weak; score = mood_fit * 3)<br>• Feedback preference (capped -2..+2; mood-aware weighting)<br>• Recent completion penalty (-1.5 within 24h)<br>• Diversity rules: max 2 same type; Okay never only breathing/grounding<br>• Deterministic tie-breaking by activity ID<br>• Gemini AI recommendation parsing, code-fence stripping, and Zod validation<br>• Fallback to rules on missing key, DEMO_MODE, timeout (>5s), invalid JSON, unknown ID | Vitest<br>Playwright |
| **FR-4** | Interactive Multi-Modal Activity Player | `tests/journey.spec.ts`<br>`tests/e2e-demo.spec.ts` | • Persistent Stop button visible across all players<br>• Breathing player controls (circle animation, pause/resume, finish early)<br>• Grounding wizard (step-by-step Next/Back navigation and completion)<br>• Journaling player (reflection prompt, textarea input, save to `/api/journal`)<br>• Movement Break player (countdown timer and suggestion steps) | Playwright |
| **FR-5** | Practice Completion & Feedback Logging | `tests/db.test.ts`<br>`tests/journey.spec.ts`<br>`tests/e2e-demo.spec.ts` | • `completeSession sets completed = 1 and timestamp`<br>• `saveFeedback logs rating and mood to DB`<br>• E2E: "Was this activity helpful?" prompt displays `Yes`, `A little`, `No`<br>• Submitting feedback immediately redirects to dashboard and logs rating | Vitest<br>Playwright |
| **FR-6** | Longitudinal Wellbeing Dashboard | `tests/db.test.ts`<br>`tests/file-db.test.ts`<br>`tests/e2e-demo.spec.ts` | • `getDashboardData aggregates checkins, sessions, ratings, and stats`<br>• SQLite file persistence and WAL mode verified<br>• Dashboard displays metric cards, mood counts, recent check-ins, and completed sessions | Vitest<br>Playwright |
| **FR-7** | Right to Erasure (Delete User Data) | `tests/db.test.ts`<br>`tests/journey.spec.ts` | • `deleteAllUserData wipes checkins, sessions, feedback, and journals`<br>• Base user record preserved for foreign key consistency<br>• E2E: "Delete my data" confirmation dialog triggers `DELETE /api/data` and resets metrics | Vitest<br>Playwright |
| **FR-8** | Idempotent Database Seeding | `tests/seed.test.ts` | • `seeds database idempotently without duplicating rows on repeated runs`<br>• Inserts 7 check-ins, 7 sessions, 7 feedback ratings across 5 days<br>• Verifies active feedback preferences (`box-breathing` yes, `body-scan` no, `brain-dump` a_little) | Vitest |
| **FR-9** | Note Themes & Situational Guidance | `tests/themes.test.ts`<br>`tests/ai.test.ts`<br>`tests/e2e-demo.spec.ts` | • Extensible situation theme detection (academics, work, sleep, relationships, loneliness, health_worry, money, general)<br>• Theme bonus (+5 for mood_fit $\ge 1$) surfaces contextually relevant activities<br>• Calm reflection acknowledgement card ($\le 60$ words) above recommendations<br>• "One small step for today" micro-action card ($\le 30$ words) below recommendations<br>• "AI" or "Rules" provenance label displayed across guidance and activities<br>• E2E: Anxious + academics note surfaces academic activity, acknowledgement, next step, and Rules badge | Vitest<br>Playwright |
| **FR-10** | Structured AI Evaluation, Candidate Isolation & Status Telemetry | `tests/ai.test.ts`<br>`tests/journey.spec.ts` | • Status endpoint (`GET /api/status`) returning `{ mode: "ai" \| "rules" }` without leaking keys<br>• Status badge on check-in interface ("AI personalisation: on" vs "Rules mode")<br>• Candidate pool isolation: Gemini evaluated strictly against top 6 rules-ranked candidates<br>• Structured schema validation: `understanding` (concern, intensity, need), `acknowledgement`, `recommendations`, `next_step`<br>• High intensity gentle handling: shortest fit recommendation + trusted person mention without crisis label<br>• Post-AI diversity enforcement: max 2 of same type, backfilled from remaining candidates in 6-pool<br>• Need tag telemetry (`Looks like you need: ...`) rendered on recommendations view<br>• Resiliency: 8000ms timeout, 1-retry on malformed JSON, and seamless fallback to rules<br>• Privacy: Zero logging of notes, prompts, or responses (only normalized failure categories) | Vitest<br>Playwright |
| **FR-11** | Follow-Up Recommendation Chat & Constraint Refinement | `tests/chat.test.ts`<br>`tests/e2e-demo.spec.ts` | • `POST /api/chat` with Zod validation (message $\le 300$ chars, history $\le 6$ turns)<br>• Pre-processing crisis check: `checkSafety(message)` runs FIRST, returns `{safety:true}`, store nothing, 0 Gemini calls<br>• Context isolation: server-side lookup of checkin mood, note, and detected themes (no client tampering)<br>• Intent parsing (`parseConstraints`): duration limits, type exclusions, swaps, why, and steps<br>• Constraint ranking (`rankActivitiesWithConstraints`): relaxes constraints progressively if $< 3$ activities match<br>• Resilient execution: templated replies in demo mode or fallback; Gemini integration with 5s timeout<br>• UI: "Want to adjust these?" chat panel, quick-reply chips, 6-message limit, in-place card updates, disclaimer<br>• Privacy: chat messages are component state only, never stored in SQLite, never logged to console | Vitest<br>Playwright |
| **FR-12** | Personalized Everyday Suggestions ("Suggestions for you") | `tests/ai.test.ts`<br>`tests/chat.test.ts`<br>`tests/e2e-demo.spec.ts` | • Gemini schema: `suggestions: [{ title, detail, when }]` (exactly 3 items, title $\le 6$ words, detail $\le 35$ words, mixed timeframes)<br>• Non-clinical safety: drops suggestions containing medical or crisis terms to rules templates while preserving 3 AI cards<br>• Fallback matrix: 40 distinct combinations ($5\text{ moods} \times 8\text{ themes}$) providing tailored everyday ideas<br>• Chat decoupling: chat adjustments do not touch suggestions; suggestions remain visible across activity card swaps<br>• UI: displays timeframe chips (`Now`, `Today`, `This week`), provenance badge (`AI-written` or `Template`), and disclaimer | Vitest<br>Playwright |

---

## 3. Actual Pass/Fail Results & Coverage

### 3.1 Test Suite Execution Results

| Test Suite | Test Files | Total Tests | Passed | Failed | Duration | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Vitest (Unit & Integration)** | 9 | 123 | 123 | 0 | 2.03s | **PASSED** |
| **Playwright (End-to-End)** | 2 | 6 | 6 | 0 | 14.50s | **PASSED** |
| **Total** | **11** | **129** | **129** | **0** | **—** | **100% PASS** |

### 3.2 Journey Performance Metrics (Playwright Telemetry)

- **Taps to Start Activity:** **3 taps** (Select mood $\rightarrow$ "Get suggestions" $\rightarrow$ "Start Activity").
- **Time to Start Activity:** **1.89s** (1,892 ms) measured wall-clock time from initial page load to interactive activity player in automated browser testing.

### 3.3 Actual Code Coverage Report (`@vitest/coverage-v8`)

| Module / File | % Statements | % Branch | % Functions | % Lines | Uncovered Lines |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **All Files (Core Engine)** | **84.40** | **76.22** | **91.17** | **85.17** | — |
| **src/lib/catalog** | **100.00** | **75.00** | **100.00** | **100.00** | — |
| ↳ `index.ts` | 100.00 | 75.00 | 100.00 | 100.00 | 6 |
| **src/lib/chat** | **86.17** | **75.96** | **92.85** | **85.59** | — |
| ↳ `ai.ts` | 85.55 | 75.75 | 92.30 | 84.70 | 148, 250, 252, 286 |
| ↳ `intent.ts` | 87.87 | 76.31 | 100.00 | 87.87 | 77, 80, 83, 86 |
| **src/lib/safety** | **100.00** | **100.00** | **100.00** | **100.00** | — |
| ↳ `index.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `phrases.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| **src/lib/db** | **89.00** | **78.83** | **88.46** | **89.41** | — |
| ↳ `repository.ts` | 90.97 | 83.96 | 90.00 | 91.60 | 344–349, 447–462 |
| ↳ `schema.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `seed.ts` | 96.15 | 81.81 | 100.00 | 96.15 | 205 |
| ↳ `connection.ts` | 65.21 | 50.00 | 66.66 | 65.21 | 13, 21–23, 35, 50–52 |
| **src/lib/recommender** | **80.80** | **74.78** | **90.56** | **82.14** | — |
| ↳ `ai.ts` | 83.72 | 77.52 | 100.00 | 83.73 | 358–359, 386–395 |
| ↳ `fallbackSuggestions.ts` | 100.00 | 62.50 | 100.00 | 100.00 | 721–722 |
| ↳ `fallbackTemplates.ts` | 69.23 | 47.05 | 100.00 | 69.23 | 219–222 |
| ↳ `index.ts` | 81.25 | 70.00 | 100.00 | 89.28 | 99–101 |
| ↳ `rules.ts` | 77.61 | 76.27 | 81.48 | 78.88 | 268, 526, 531–532, 584 |
| ↳ `themeKeywords.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `themes.ts` | 100.00 | 87.50 | 100.00 | 100.00 | 43 |

---

## 4. Known Limitations

1. **Single-User Architecture:** The system uses a hardcoded user identity (`demo-user`) and local SQLite database without authentication, authorization, or multi-tenant user isolation.
2. **Heuristic Safety Detection:** The crisis check relies on a static list of exact normalized phrases. It is a baseline safeguard to display crisis contacts, not a clinical risk assessment; colloquial, misspelled, or novel expressions of distress may evade detection.
3. **External Gemini API Dependency:** When AI recommendations are enabled, the system depends on the Google Gemini API and network connectivity. Network latency, quota exhaustion, or missing credentials cause automatic fallback to rule-based recommendations.
4. **Local Database Persistence:** User data resides in a single SQLite database file at `./data/mindora.db`. File deletion, corruption, or running without write permissions on the host filesystem clears all history.
5. **Non-Clinical Scope:** By design, the application does not offer medical advice, diagnostic capabilities, or emergency response dispatch.
