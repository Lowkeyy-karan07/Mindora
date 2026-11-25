# Mindora — Test Report

## 1. Tools Used

- **Vitest (v5.1.1)** with `@vitest/coverage-v8`: Executes unit and integration test suites, validating the SQLite database repository, safety keyword matching, rules-based activity scoring, and mocked Gemini AI recommendation flows.
- **Playwright (v1.65.1)** with Chromium: Executes browser-level end-to-end (E2E) integration tests against the Next.js production build (`DEMO_MODE=true`), validating UI workflows, multi-modal activity players, feedback collection, dashboard updates, and journey timing.

---

## 2. Test Cases Mapped to SRS Functional Requirements

| FR ID | Requirement | Test File | Test Cases / Scenarios | Tool |
| :--- | :--- | :--- | :--- | :--- |
| **FR-1** | Mood Check-in & Input Validation | `tests/db.test.ts`<br>`tests/journey.spec.ts` | • `creates checkin and persists to DB`<br>• `retrieves recent checkins in desc order`<br>• Select 5 mood options, enter note ($\le 300$ chars), submit check-in | Vitest<br>Playwright |
| **FR-2** | Phrase-Based Crisis Interception | `tests/safety.test.ts`<br>`tests/e2e-demo.spec.ts` | • 8 crisis phrases MUST trigger (`"i want to end my life"`, `"suicide"`, etc.)<br>• 8 ordinary phrases MUST NOT trigger (`"deadline is killing me"`, `"back hurts"`, etc.)<br>• Normalization, whitespace, and punctuation tests<br>• E2E: Note with crisis phrase renders Safety Screen and generates 0 recommendations | Vitest<br>Playwright |
| **FR-3** | Hybrid Activity Recommendation Engine | `tests/recommender.test.ts`<br>`tests/ai.test.ts`<br>`tests/e2e-demo.spec.ts` | • Returns exactly 3 recommendations with reasons<br>• Mood-matching activities rank higher<br>• Feedback promotes (`yes` +2) and demotes (`no` -2)<br>• Recent completion penalty (-1.5 within 24h)<br>• Deterministic tie-breaking by activity ID<br>• Gemini AI recommendation parsing, code-fence stripping, and Zod validation<br>• Fallback to rules on missing key, DEMO_MODE, timeout (>5s), or invalid JSON | Vitest<br>Playwright |
| **FR-4** | Interactive Multi-Modal Activity Player | `tests/journey.spec.ts`<br>`tests/e2e-demo.spec.ts` | • Persistent Stop button visible across all players<br>• Breathing player controls (circle animation, pause/resume, finish early)<br>• Grounding wizard (step-by-step Next/Back navigation and completion)<br>• Journaling player (reflection prompt, textarea input, save to `/api/journal`)<br>• Movement Break player (countdown timer and suggestion steps) | Playwright |
| **FR-5** | Practice Completion & Feedback Logging | `tests/db.test.ts`<br>`tests/journey.spec.ts`<br>`tests/e2e-demo.spec.ts` | • `completeSession sets completed = 1 and timestamp`<br>• `saveFeedback logs rating to DB`<br>• E2E: "Was this activity helpful?" prompt displays `Yes`, `A little`, `No`<br>• Submitting feedback immediately redirects to dashboard and logs rating | Vitest<br>Playwright |
| **FR-6** | Longitudinal Wellbeing Dashboard | `tests/db.test.ts`<br>`tests/file-db.test.ts`<br>`tests/e2e-demo.spec.ts` | • `getDashboardData aggregates checkins, sessions, ratings, and stats`<br>• SQLite file persistence and WAL mode verified<br>• Dashboard displays metric cards, mood counts, recent check-ins, and completed sessions | Vitest<br>Playwright |
| **FR-7** | Right to Erasure (Delete User Data) | `tests/db.test.ts`<br>`tests/journey.spec.ts` | • `deleteAllUserData wipes checkins, sessions, feedback, and journals`<br>• Base user record preserved for foreign key consistency<br>• E2E: "Delete my data" confirmation dialog triggers `DELETE /api/data` and resets metrics | Vitest<br>Playwright |
| **FR-8** | Idempotent Database Seeding | `tests/seed.test.ts` | • `seeds database idempotently without duplicating rows on repeated runs`<br>• Inserts 7 check-ins, 7 sessions, 7 feedback ratings across 5 days<br>• Verifies active feedback preferences (`box-breathing` yes, `body-scan` no, `brain-dump` a_little) | Vitest |

---

## 3. Actual Pass/Fail Results & Coverage

### 3.1 Test Suite Execution Results

| Test Suite | Test Files | Total Tests | Passed | Failed | Duration | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Vitest (Unit & Integration)** | 6 | 59 | 59 | 0 | 1.13s | **PASSED** |
| **Playwright (End-to-End)** | 2 | 5 | 5 | 0 | 11.90s | **PASSED** |
| **Total** | **8** | **64** | **64** | **0** | **—** | **100% PASS** |

### 3.2 Journey Performance Metrics (Playwright Telemetry)

- **Taps to Start Activity:** **3 taps** (Select mood $\rightarrow$ "Get suggestions" $\rightarrow$ "Start Activity").
- **Time to Start Activity:** **0.99s – 1.09s** measured wall-clock time from initial page load to interactive player.

### 3.3 Actual Code Coverage Report (`@vitest/coverage-v8`)

| Module / File | % Statements | % Branch | % Functions | % Lines | Uncovered Lines |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **All Files (Core Engine)** | **93.05** | **83.87** | **98.07** | **93.39** | — |
| **src/lib/catalog** | **100.00** | **100.00** | **100.00** | **100.00** | — |
| ↳ `index.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| **src/lib/safety** | **100.00** | **100.00** | **100.00** | **100.00** | — |
| ↳ `index.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `phrases.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| **src/lib/db** | **93.33** | **83.33** | **95.83** | **93.29** | — |
| ↳ `repository.ts` | 98.16 | 91.56 | 100.00 | 98.14 | 207, 215 |
| ↳ `schema.ts` | 100.00 | 100.00 | 100.00 | 100.00 | None |
| ↳ `seed.ts` | 96.15 | 81.81 | 100.00 | 96.15 | 204 |
| ↳ `connection.ts` | 65.21 | 50.00 | 66.66 | 65.21 | 13, 21–23, 35, 50–52 |
| **src/lib/recommender** | **91.78** | **83.15** | **100.00** | **92.70** | — |
| ↳ `ai.ts` | 90.38 | 75.86 | 100.00 | 90.19 | 69, 74, 121, 131, 166 |
| ↳ `rules.ts` | 92.10 | 82.69 | 100.00 | 94.20 | 46, 98, 103, 201 |
| ↳ `index.ts` | 94.44 | 100.00 | 100.00 | 94.11 | 48 |

---

## 4. Known Limitations

1. **Single-User Architecture:** The system uses a hardcoded user identity (`demo-user`) and local SQLite database without authentication, authorization, or multi-tenant user isolation.
2. **Heuristic Safety Detection:** The crisis check relies on a static list of exact normalized phrases. It is a baseline safeguard to display crisis contacts, not a clinical risk assessment; colloquial, misspelled, or novel expressions of distress may evade detection.
3. **External Gemini API Dependency:** When AI recommendations are enabled, the system depends on the Google Gemini API and network connectivity. Network latency or missing credentials cause automatic fallback to rule-based recommendations.
4. **Local Database Persistence:** User data resides in a single SQLite database file at `./data/mindora.db`. File deletion, corruption, or running without write permissions on the host filesystem clears all history.
5. **Non-Clinical Scope:** By design, the application does not offer medical advice, diagnostic capabilities, or emergency response dispatch.
