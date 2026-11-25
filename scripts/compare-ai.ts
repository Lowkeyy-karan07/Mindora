import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        if (typeof process.loadEnvFile === 'function') {
          process.loadEnvFile(fullPath);
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) {
                process.env[k] = v;
              }
            }
          }
        }
      } catch {
        // continue
      }
    }
  }
}

loadEnv();

import { recommend } from '../src/lib/recommender';
import { Mood } from '../src/types';

interface EvalCase {
  mood: Mood;
  note: string;
}

const EVAL_CASES: EvalCase[] = [
  { mood: 'Anxious', note: 'Not performing well in academics' },
  {
    mood: 'Stressed',
    note: 'My teammate is not contributing anything to our project and the deadline is close',
  },
  {
    mood: 'Stressed',
    note: "My manager keeps adding work and I can't switch off at night",
  },
  { mood: 'Sad', note: 'I miss my friends since moving to a new city' },
  {
    mood: 'Overwhelmed',
    note: 'Exams, project and family function all this week',
  },
  { mood: 'Anxious', note: 'I have a medical test result coming tomorrow' },
  { mood: 'Sad', note: 'Money is tight this month and I feel embarrassed' },
  { mood: 'Okay', note: '' },
];

const GENERIC_STEP_REGEX = /\b(water|stretch|breathe|breath)\b/i;

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('Error: GEMINI_API_KEY is missing in environment.');
    process.exit(1);
  }

  console.log('\n====================================================================');
  console.log(`MINDORA COMPARE:AI vs RULES (Model: ${process.env.GEMINI_MODEL || 'default'})`);
  console.log('====================================================================\n');

  let aiSucceededCount = 0;
  let nowOrNextDifferCount = 0;
  let genericStepDetectedCount = 0;

  for (let i = 0; i < EVAL_CASES.length; i++) {
    const { mood, note } = EVAL_CASES[i];

    // Small spacing between live API bursts so free-tier RPM doesn't throttle
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 1. Run with Rules (DEMO_MODE=true)
    process.env.DEMO_MODE = 'true';
    const rulesRes = await recommend(mood, note);
    const rulesPlan = rulesRes.plan!;

    // 2. Run with Real Gemini AI (DEMO_MODE=false)
    process.env.DEMO_MODE = 'false';
    const aiDiagnostics: string[] = [];
    const aiRes = await recommend(mood, note, 'demo-user', undefined, (msg) =>
      aiDiagnostics.push(msg)
    );
    const aiPlan = aiRes.plan!;

    const aiUsedForActivities =
      aiPlan.now.by === 'ai' || aiPlan.next.some((n) => n.by === 'ai');
    if (aiUsedForActivities) aiSucceededCount++;

    const rulesNowId = rulesPlan.now.activity.id;
    const aiNowId = aiPlan.now.activity.id;
    const rulesNextIds = rulesPlan.next.map((n) => n.activity.id);
    const aiNextIds = aiPlan.next.map((n) => n.activity.id);

    const nowDiffers = aiNowId !== rulesNowId;
    const nextDiffers =
      aiNextIds[0] !== rulesNextIds[0] || aiNextIds[1] !== rulesNextIds[1];
    const differs = nowDiffers || nextDiffers;
    if (differs) nowOrNextDifferCount++;

    const aiStepTitles = aiPlan.later.action_steps.map((s) => s.step);
    const rulesStepTitles = rulesPlan.later.action_steps.map((s) => s.step);

    // Check whether non-empty note check-ins produced any generic action steps
    const hasGenericStep =
      note.trim().length > 0 &&
      aiPlan.later.action_steps.some((s) => GENERIC_STEP_REGEX.test(s.step));
    if (hasGenericStep) genericStepDetectedCount++;

    console.log(`[${i + 1}/8] ${mood} + "${note || '(empty)'}"`);
    if (aiDiagnostics.length > 0) {
      console.log(`  Diagnostic:    ${aiDiagnostics.join(' | ')}`);
    }
    console.log(
      `  AI Status:     now=${aiPlan.now.by}, next=[${aiPlan.next.map((n) => n.by).join(',')}], later=${aiPlan.later.by}`
    );
    console.log(
      `  AI Now:        ${aiPlan.now.activity.title} (${aiNowId})`
    );
    console.log(
      `  Rules Now:     ${rulesPlan.now.activity.title} (${rulesNowId})`
    );
    console.log(
      `  AI Next:       ${aiPlan.next.map((n) => `${n.activity.title} (${n.activity.id})`).join(' | ')}`
    );
    console.log(
      `  Rules Next:    ${rulesPlan.next.map((n) => `${n.activity.title} (${n.activity.id})`).join(' | ')}`
    );
    console.log(
      `  AI Steps (3):  ${aiStepTitles.join(' | ')}`
    );
    console.log(
      `  Rules Steps:   ${rulesStepTitles.join(' | ')}`
    );
    console.log(
      `  Differs:       ${differs ? `YES (now=${nowDiffers}, next=${nextDiffers})` : 'NO (identical picks)'} | Generic non-empty AI step: ${hasGenericStep ? 'YES' : 'NO'}`
    );
    console.log('');
  }

  console.log('====================================================================');
  console.log('SUMMARY:');
  console.log(`  Total evaluated:                       ${EVAL_CASES.length}`);
  console.log(`  AI live evaluations succeeded:         ${aiSucceededCount}/${EVAL_CASES.length}`);
  console.log(`  Now/Next differed from Rules:          ${nowOrNextDifferCount}/${EVAL_CASES.length}`);
  console.log(`  Non-empty notes w/ generic step word:  ${genericStepDetectedCount}/${EVAL_CASES.filter((c) => c.note).length}`);
  console.log('====================================================================\n');
}

main().catch((err) => {
  console.error('compare:ai failed:', err instanceof Error ? err.message : 'error');
  process.exit(1);
});
