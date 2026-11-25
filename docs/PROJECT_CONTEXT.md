=== SPEC ===
Mindora: Personalized Wellbeing Coach. ONE core problem: people under everyday stress cannot easily decide which simple wellbeing activity suits their mood; Mindora reduces this to one check-in and three explained, feedback-aware suggestions.
Journey: mood check-in → 3 recommendations with reasons → interactive activity → feedback → dashboard. Feedback changes future rankings.
NOT a therapist/diagnostic/emergency service. Never diagnose or give medical advice.
Moods: Anxious, Stressed, Sad, Overwhelmed, Okay. Optional note max 300 chars.
Stack: Next.js, TS, Tailwind, better-sqlite3 at ./data/mindora.db (path relative to project root, auto-create dir), Zod validation, Gemini (@google/genai) server-side only via GEMINI_API_KEY and GEMINI_MODEL env vars. API routes use Node runtime (export const runtime = "nodejs"). Single seeded user "demo-user"; every table has user_id. No auth.
Tables: users(id,created_at); checkins(id,user_id,mood,note,created_at); sessions(id,user_id,checkin_id,activity_id,started_at,completed_at,completed); feedback(id,user_id,session_id,rating yes|a_little|no,created_at); journal_entries(id,user_id,session_id,prompt,text,created_at).
Activities come from /src/lib/catalog/activities.json (id,title,type breathing|grounding|journaling|break,duration_minutes,mood_fit Record<Mood, 1|2|3> with max 3 moods,target_themes[],description,steps[]).
Feedback scoring: score = mood_fit * 3 + theme bonus (+5 if mood_fit >= 1) + feedback preference (capped to -2..+2) - small penalty if completed in last 24h. Mood fit dominates feedback. Mood-aware feedback prefers feedback given under the same mood; feedback under a different mood counts at half weight. Diversity: top 3 has at most 2 activities of the same type; Okay must never return only breathing/grounding. Deterministic tie-break by activity id.
Privacy: disclose storage; disclose Gemini use; never send identifying info; never log notes/journals (log failure categories only); rules-only mode when DEMO_MODE=true or no key; Delete my data removes everything for the user.
Safety: basic phrase-based crisis trigger (NOT a reliable risk assessment); runs first; if triggered, no Gemini call, no recommendations, show supportive screen (trusted person, local emergency services, local crisis service; don't hardcode one country). Footer disclaimer on all pages.
Note themes: The optional note is used to pick situation-specific activities, in both rules and AI mode. Themes are detected via keyword/phrase matching (e.g. academics, work, sleep, relationships, loneliness, health_worry, money, general) and grant a theme-match bonus (+5 for mood_fit >= 1) to surface contextually relevant activities with situation-specific reasons.
AI Evaluation & Status:
- Status API: GET /api/status returns { mode: "ai" | "rules" } without secrets. The check-in page shows a status badge ("AI personalisation: on" or "Rules mode").
- Candidate Pool: Gemini selects only from the top 6 scored candidates from rankActivities (mood_fit >= 1, theme bonus and feedback included, same-type cap not applied).
- Structured JSON: Gemini returns {"understanding":{"main_concern":"","intensity":"low|medium|high","need":"calm|focus|comfort|connection|energy|reflect"},"acknowledgement":"","recommendations":[{"activity_id":"","reason":""}],"next_step":""}.
- Need Tag: Recommendations view displays a badge with the identified need (e.g. "Looks like you need: focus").
- Resilience & Retries: 8s timeout, 1 retry on invalid JSON, automatic fallback to rules with situation-specific guidance. Re-applies same-type cap (max 2 of one type) after AI picks. Never logs notes.
Follow-up chat:
- The follow-up chat only refines the 3 recommendations for the current check-in. It is not a general chatbot, is not therapy, and cannot provide medical advice.
- Chat text is ephemeral (held in client state only for the session), is never stored in the database, and is never logged to server logs or console.
- Quick chips & constraints: adjusts recommendations based on user constraints (max duration, exclude/include types, swapping cards, explaining why or how to practice).
- Safety first: checkSafety runs on every chat message before any AI or processing. If triggered, returns {safety: true}, makes no Gemini call, stores nothing, and renders the Safety Screen.
- Fallback: in DEMO_MODE=true or when Gemini fails/times out (5s), responds using templated responses and deterministic rules constraint ranking.
Suggestions for you:
- A second output next to the 3 curated recommendation cards displaying 3 personalised, practical everyday wellbeing ideas written by Gemini in response to user mood and note.
- Output schema: suggestions: [{ title: string (max 6 words), detail: string (max 35 words), when: 'now' | 'today' | 'this_week' }].
- Timeframe diversity: at least one 'now' (under 5 mins) and one 'today'.
- Distinct from the 3 curated activity cards and distinct from next_step.
- Safe and non-clinical: everyday wellbeing ideas only; never diagnose, no medical/diet/medication advice or guarantees; if intensity is 'high', includes one suggestion about reaching out to a trusted person.
- Validated with Zod and scanned for crisis/medical terms; falls back to templated suggestions per mood x theme (suggestions_by: 'rules') if invalid.
- Persistent across follow-up chat: generated once during check-in and stays visible when chat refines the 3 cards; /api/chat does not return or modify them.
=== END SPEC ===
