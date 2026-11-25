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

// Force AI mode for real verification
process.env.DEMO_MODE = 'false';

import { recommend } from '../src/lib/recommender';
import { Mood } from '../src/types';

interface Case {
  mood: Mood;
  note: string;
}

const cases: Case[] = [
  {
    mood: 'Stressed',
    note: 'My teammate is not contributing anything to our project and the deadline is close',
  },
  {
    mood: 'Anxious',
    note: 'Not performing well in academics, exams are approaching',
  },
  {
    mood: 'Sad',
    note: 'I miss my friends since moving to a new city',
  },
  {
    mood: 'Overwhelmed',
    note: 'Exams, project and family function all this week',
  },
  {
    mood: 'Okay',
    note: '',
  },
];

async function run() {
  const isAiActive = Boolean(process.env.GEMINI_API_KEY && process.env.DEMO_MODE !== 'true');
  console.log(`\n===============================================================`);
  console.log(`EVALUATING CHECK-INS (Active Mode: ${isAiActive ? 'REAL GEMINI AI' : 'RULES FALLBACK'})`);
  console.log(`===============================================================\n`);

  for (let i = 0; i < cases.length; i++) {
    const { mood, note } = cases[i];
    console.log(`---------------------------------------------------------------`);
    console.log(`[Check-in ${i + 1}] Mood: "${mood}" | Note: "${note}"`);
    console.log(`---------------------------------------------------------------`);

    const res = await recommend(mood, note);
    const titles = res.map((r) => r.activity.title).join(' | ');

    console.log(`Need Tag:             ${res.need || res.understanding?.need || 'N/A'}`);
    console.log(`Relevant Themes:      ${res.relevant_themes?.join(', ') || 'none'}`);
    console.log(`Acknowledgement:      ${res.acknowledgement}`);
    console.log(`Personalised By:      ${res[0]?.personalised_by}`);
    console.log(`3 Activities:         ${titles}`);
    for (let a = 0; a < res.length; a++) {
      console.log(`   ${a + 1}. [${res[a].activity.type}] ${res[a].activity.title} (${res[a].activity.duration_minutes}m) - "${res[a].reason}"`);
    }
    console.log(`Next Step:            ${res.next_step}`);
    console.log(`\nYour Situation (Source: ${res.situation_by}):`);
    console.log(`   Summary:           ${res.situation?.summary || 'N/A'}`);
    console.log(`   In Your Control:   ${res.situation?.what_is_in_your_control || 'N/A'}`);
    console.log(`   Action Steps:`);
    if (res.situation?.action_steps) {
      for (const step of res.situation.action_steps) {
        console.log(`      - [${step.time.toUpperCase()}] ${step.step}: ${step.detail}`);
      }
    }
    console.log(`\nSuggestions (Source: ${res.suggestions_by}):`);
    if (res.suggestions) {
      for (const s of res.suggestions) {
        console.log(`      - [${s.when.toUpperCase()}] ${s.title}: ${s.detail}`);
      }
    }
    console.log('');
  }
}

run();
