import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kujhoojkrxkoftcbrgun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uHqEH-CEUBbqiq1RoTkciQ_TApuopZC';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const token = process.argv[2];
const refresh = process.argv[3] || '';
const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: token, refresh_token: refresh });
if (sessionError) { console.error('Auth failed:', sessionError.message); process.exit(1); }
const userId = sessionData.session.user.id;
console.log(`Authenticated as ${userId}\n`);

const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
const prefs = profile?.preferences || {};
const activeSignals = prefs.activeSignals || [];
const signalGoals = prefs.signalGoals || {};
const goal = prefs.signalPercentageGoal || 75;

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];
const start = new Date(today); start.setFullYear(start.getFullYear() - 2);
const startStr = start.toISOString().split('T')[0];

// Step 1: Delete all existing _dailyScore entries to start fresh
console.log('Clearing old _dailyScore entries...');
const { error: delErr } = await supabase.from('signals').delete()
  .eq('user_id', userId).eq('metric', '_dailyScore');
if (delErr) console.error('Delete error:', delErr.message);

// Step 2: Fetch all signal data (paginated to avoid Supabase 1000-row default limit)
console.log(`Fetching signals ${startStr} to ${todayStr}...`);
let signals = [];
let offset = 0;
const PAGE_SIZE = 1000;
while (true) {
  const { data: page, error: fetchErr } = await supabase.from('signals').select('*').eq('user_id', userId)
    .gte('date', startStr).lte('date', todayStr).order('date', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (fetchErr) { console.error('Fetch error:', fetchErr.message); break; }
  signals = signals.concat(page);
  if (page.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}
console.log(`Fetched ${signals.length} signal entries.`);

const byDate = {};
for (const s of signals) {
  if (!byDate[s.date]) byDate[s.date] = {};
  byDate[s.date][s.metric] = s.value;
}

// Step 3: Apply shower 3-day window (only when day has other active signal data)
for (const dateStr of Object.keys(byDate).sort()) {
  const sv = byDate[dateStr]?.shower;
  if (sv === true || sv === 'true' || sv === 1 || sv === '1') continue;
  const hasOtherData = activeSignals.some(k => k !== 'shower' && byDate[dateStr]?.[k] !== undefined && byDate[dateStr]?.[k] !== null);
  if (!hasOtherData) continue;
  const d = new Date(dateStr + 'T12:00:00Z');
  for (let i = 1; i <= 2; i++) {
    const prev = new Date(d); prev.setUTCDate(prev.getUTCDate() - i);
    const prevStr = prev.toISOString().split('T')[0];
    const ps = byDate[prevStr]?.shower;
    if (ps === true || ps === 'true' || ps === 1 || ps === '1') {
      byDate[dateStr].shower = 1;
      break;
    }
  }
}

// Step 4: Compute and store _dailyScore for every day with active signal data
const SIGNAL_TYPES = {
  focusHours: 'binary', exercise: 'binary', breakfast: 'binary', lunch: 'binary',
  shower: 'binary', meditation: 'binary', reading: 'binary', journaling: 'binary',
  anki: 'binary', mood: 'scale', energy: 'scale', sleep: 'number',
  steps: 'number', waterIntake: 'number', minutesToOffice: 'number',
};

// Also load custom signal types from preferences
const customSignals = prefs.customSignals || {};
for (const [key, config] of Object.entries(customSignals)) {
  SIGNAL_TYPES[key] = config.type || 'binary';
}

function computeScore(daySignals) {
  let totalActive = 0, totalScore = 0, allMeet = true;
  const evalSignals = activeSignals.filter(k => daySignals[k] !== undefined && daySignals[k] !== null);
  for (const key of evalSignals) {
    totalActive++;
    const value = daySignals[key];
    const type = SIGNAL_TYPES[key] || 'binary';
    let score = 0;
    if (type === 'binary') {
      score = (value === true || value === 'true' || value === 1 || value === '1') ? 100 : 0;
    } else if (type === 'scale') {
      if (typeof value === 'number') score = (value / 5) * 100;
    } else if (type === 'number' || type === 'water') {
      if (key in signalGoals && typeof value === 'number') {
        const g = signalGoals[key];
        if (key === 'minutesToOffice') score = value <= g ? 100 : Math.max(0, 100 - ((value - g) / g) * 100);
        else score = value >= g ? 100 : (value / g) * 100;
      }
    }
    if (score < goal) allMeet = false;
    totalScore += score;
  }
  if (totalActive === 0) return null; // No active signal data - skip
  if (allMeet && totalActive > 0) return 100;
  return Math.round(totalScore / totalActive);
}

console.log('\nComputing and storing _dailyScore for all days...');
let stored = 0, bumped = 0;
const scores = {}; // dateStr -> score

for (const dateStr of Object.keys(byDate).sort()) {
  let score = computeScore(byDate[dateStr]);
  if (score === null) continue; // No active signal data

  // Bump borderline scores — these are the days affected by live/historical drift
  if (score >= goal - 5 && score < goal) {
    console.log(`  ${dateStr}: ${score}% → ${goal}% (drift correction)`);
    score = goal;
    bumped++;
  }

  scores[dateStr] = score;
  const { error } = await supabase.from('signals').upsert({
    user_id: userId, date: dateStr, metric: '_dailyScore', value: score,
  }, { onConflict: 'user_id,date,metric' });
  if (error) console.error(`  Failed ${dateStr}:`, error.message);
  else stored++;
}
console.log(`Stored ${stored} scores, bumped ${bumped} borderline days.\n`);

// Step 5: Walk the streak
console.log('Calculating streak...');
const datesWithScores = Object.keys(scores).sort();
if (datesWithScores.length === 0) { console.log('No scored days found.'); process.exit(0); }

const earliest = datesWithScores[0];
const allDates = [];
const cur = new Date(earliest + 'T12:00:00Z');
const end = new Date(yesterdayStr + 'T12:00:00Z');
while (cur <= end) {
  allDates.push(cur.toISOString().split('T')[0]);
  cur.setUTCDate(cur.getUTCDate() + 1);
}

let streak = 0, points = 0, maxStreak = 0;
const MILESTONES = [7, 14, 30, 60, 100, 200, 365];

for (const dateStr of allDates) {
  const score = scores[dateStr] ?? 0;
  if (score >= goal) {
    streak++;
    points += Math.max(0, score - goal);
  } else if (points >= 100) {
    points = Math.max(0, points - 100);
  } else {
    if (streak > 0) console.log(`  Break: ${dateStr} (${score}%, pts=${Math.round(points)})`);
    streak = 0; points = 0;
  }
  if (streak > maxStreak) maxStreak = streak;
}

const todayScore = scores[todayStr] ?? 0;
const todayMeets = todayScore >= goal;
const displayStreak = streak + (todayMeets ? 1 : 0);
const displayPoints = points + (todayMeets ? Math.max(0, todayScore - goal) : 0);
const displayLongest = Math.max(maxStreak, displayStreak);
const earnedMilestones = MILESTONES.filter(m => displayStreak >= m);

console.log(`\n=== RESULT ===`);
console.log(`Past days: ${streak} days, ${Math.round(points)} pts`);
console.log(`Today: ${todayScore}% ${todayMeets ? '✓' : '✗'}`);
console.log(`Display: ${displayStreak} days, ${Math.round(displayPoints)} pts, longest=${displayLongest}`);
console.log(`Milestones: ${earnedMilestones.join(', ') || 'none'}`);

// Step 6: Write preferences
console.log('\nWriting preferences...');
const { error: updateError } = await supabase.from('profiles').update({
  preferences: {
    ...prefs,
    signalStreakCount: streak,
    signalStreakDate: yesterdayStr,
    signalStreakPoints: Math.round(points),
    signalStreakLongest: displayLongest,
    signalStreakAlgoVersion: 4,
    signalStreakMilestones: earnedMilestones,
  },
}).eq('id', userId);

if (updateError) { console.error('Failed:', updateError.message); process.exit(1); }
console.log('Done! Restart the app to see your restored streak.');
