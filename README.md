# Mindora — Decision Relief for Everyday Wellbeing

> **Disclaimer:** Mindora is not a therapist, medical service, or emergency service.

Mindora is a personalized wellbeing coach web application built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **SQLite (`better-sqlite3`)**. It pairs a deterministic rules and pool-ranking engine with an optional, strictly constrained **Google Gemini** integration so people under everyday stress can get immediate, practical relief without decision fatigue.

---

## 🎯 The One Core Problem

> **People experiencing everyday stress, anxiety, or emotional heaviness often cannot easily decide which wellbeing practice or coping step fits their moment.**

Mindora reduces that cognitive load to one check-in and an ordered, non-clinical plan delivered in **3 taps** (**1.75s** measured end-to-end from check-in open to active player).

---

## ⚙️ How It Works

1. **Check-in (`/`):** Select one of 5 moods (`Anxious`, `Stressed`, `Sad`, `Overwhelmed`, `Okay`) and optionally add a brief thought (max 300 characters, `autoComplete="off"`).
2. **Safety Gate (Runs First):** `checkSafety(note)` runs before persisting anything or calling AI. If a crisis phrase is matched, Mindora immediately displays supportive human helpline resources (`SafetyScreen`) without generating recommendations or storing the note.
3. **Ordered Wellbeing Plan:**
   - **Reflection & Situation:** Empathetic acknowledgement, detected primary need badge (`Looks like you need: X`), rationale (`Why this order`), and a **Your situation** card (`summary` and `what's in your control`).
   - **Right now (about 1–2 minutes):** One prominent quick-relief activity (`<= 2` min) matching the mood's relief goal (`calm` for Anxious/Stressed/Overwhelmed; `lift` for Sad/Okay), paired with a tailored micro-action and a single **Start now** button.
   - **Next, when you're ready:** Two diverse follow-up activities addressing the situation from the curated 36-activity catalog.
   - **Later today:** Three concrete practical coping steps (`Now`, `Today`, `This week`) plus **One small step for today**.
   - **Follow-up Chat (Ephemeral):** Refines **Right now** and **Next** in place via quick chips or constraints (`no breathing`, `shorter please`, `something else`, `why these?`) without modifying **Your situation** or **Later today**, and without storing or logging chat text.
4. **Interactive Activity Player (`/activity/[sessionId]`):** Guided breathing visualizer, step-by-step grounding wizard, private journaling prompt, or timed break with an always-visible **Stop** button.
5. **Single-Tap Feedback:** Submitting `Yes`, `A little`, or `No` saves mood-aware feedback (same mood at `1.0` weight, different mood at `0.5` weight) and returns to the plan with **Right now** marked `Done` and **Next** highlighted.
6. **Dashboard (`/dashboard`):** Displays recent check-ins, completed sessions, feedback history, and an atomic **Delete my data** button.

---

## 🤖 Role of AI

Mindora separates **language interpretation** from **safety, eligibility, and control**:
- **What Gemini does:** When `GEMINI_API_KEY` is configured and `DEMO_MODE` is not `true`, Gemini reads the raw note (primary signal), mood, theme hints, the code-filtered pools (`now_pool` and `next_pool`), and an anonymised feedback summary (`liked`/`neutral`/`disliked` and completion count) to decide which eligible activities fit best, explain why, and write practical non-clinical coping steps.
- **What code owns:** Deterministic rules own the crisis safety gate (`checkSafety`), activity eligibility (`mood_fit >= 1`, `quick`, mood-goal `relief`), pool construction (`buildPools`), Zod & type/diversity/safety validation (`validatePlan`), feedback storage, and deterministic template fallbacks (`buildRulesPlan`).
- **Offline / Rules-only mode:** Mindora works completely with no API key (`DEMO_MODE=true` or omitted `GEMINI_API_KEY`), using deterministic scoring and `mood x theme` fallback templates across all 10 themes (`academics`, `work`, `sleep`, `relationships`, `loneliness`, `health_worry`, `money`, `teamwork`, `conflict`, `general`).

---

## 🛠️ Tech Stack

- **Framework & Language:** Next.js 16.4.6 (App Router, `runtime = "nodejs"` API routes), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (mobile-first, accessible ARIA roles, `prefers-reduced-motion`)
- **Database:** Embedded SQLite via `better-sqlite3` (WAL mode at `./data/mindora.db`)
- **Validation & AI:** Zod v4, `@google/genai` (server-side only, 8s timeout, 1 retry, Zod validation)
- **Testing:** Vitest (with V8 coverage), Playwright (Chromium E2E)

---

## 🔒 Privacy & Safety Notes

- **Privacy:** Check-in history, sessions, feedback, and private journal entries are stored locally in `./data/mindora.db`. Gemini requests contain zero `user_id`, session IDs, or identifying metadata, and are disabled completely when `DEMO_MODE=true`, when no API key is set, or when the safety check triggers.
- **Zero Server Logging of Sensitive Text:** Check-in notes, journal entries, and chat text are never logged to server consoles (AI errors log normalized failure categories only). Follow-up chat messages live solely in client React state.
- **Right to Erasure:** `DELETE /api/data` (`Delete my data`) atomically removes all check-ins, sessions, feedback, and journal entries.
- **Safety:** Phrase-based crisis detection runs before database writes and before any Gemini API call. Mindora is not a therapist, medical service, or emergency service.

---

## 🚀 Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Create `.env.local` from `.env.example`:**
   ```bash
   cp .env.example .env.local
   ```
   Leave `GEMINI_API_KEY` blank and set `DEMO_MODE=true` to run purely in offline Rules mode, or set `GEMINI_API_KEY` to your Google AI Studio key and `DEMO_MODE=false` in `.env.local` to enable Gemini personalisation. Never commit `.env.local`.
3. **Seed the local database:**
   ```bash
   npm run seed
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). The homepage status badge displays **AI personalisation: on** or **Rules mode** accurately from `GET /api/status`.

---

## 🧪 Testing & Verification Commands

All commands defined in `package.json`:

```bash
# Run all Vitest unit & integration tests (137 tests across 10 files)
npm test

# Run Vitest with V8 code coverage report (86.81% statements / 87.62% lines)
npm run test:coverage

# Run Playwright end-to-end browser tests in DEMO_MODE=true (6 tests)
npm run test:e2e

# Verify Gemini API key connectivity and JSON mode health (prints "AI OK" or error category)
npm run check:ai

# Compare live Gemini decisions vs deterministic rules across 8 scenarios (terminal only)
npm run compare:ai

# Production build & TypeScript check
npm run build
```

---

## 📚 Documentation

- 📄 [Software Requirements Specification (`/docs/SRS.md`)](docs/SRS.md)
- 🧪 [Test Report (`/docs/Test_Report.md`)](docs/Test_Report.md)
- 📊 [Actual Test & Evaluation Results (`/docs/test-results.md`)](docs/test-results.md)
- 🖥️ [Presentation Deck (`/docs/Mindora_Presentation.pptx`)](docs/Mindora_Presentation.pptx)
- 📋 [Project Context Spec (`/docs/PROJECT_CONTEXT.md`)](docs/PROJECT_CONTEXT.md)
