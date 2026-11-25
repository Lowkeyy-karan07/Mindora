import { rankActivities } from '../src/lib/recommender/rules';
import { MOODS } from '../src/types';

console.log('=== TOP 3 FOR EACH MOOD (EMPTY NOTE) ===');
for (const mood of MOODS) {
  const recs = rankActivities(mood, null, null, { note: '' });
  console.log(`\nMood: ${mood}`);
  recs.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.activity.type}] ${r.activity.title} (id: ${r.activity.id})`);
    console.log(`     Reason: "${r.reason}"`);
  });
}

console.log('\n=== TOP 3 FOR ANXIOUS WITH NOTE: "Not performing well in academics" ===');
const anxiousAcademicRecs = rankActivities('Anxious', null, null, { note: 'Not performing well in academics' });
anxiousAcademicRecs.forEach((r, idx) => {
  console.log(`  ${idx + 1}. [${r.activity.type}] ${r.activity.title} (id: ${r.activity.id})`);
  console.log(`     Reason: "${r.reason}"`);
});
