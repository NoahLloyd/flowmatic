import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kujhoojkrxkoftcbrgun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uHqEH-CEUBbqiq1RoTkciQ_TApuopZC';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const token = process.argv[2];
const refresh = process.argv[3] || '';

const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
  access_token: token,
  refresh_token: refresh,
});
if (sessionError) { console.error('Auth failed:', sessionError.message); process.exit(1); }

const userId = sessionData.session.user.id;
const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
const prefs = profile?.preferences || {};

const activeSignals = prefs.activeSignals || [];
const signalGoals = prefs.signalGoals || {};
const goal = prefs.signalPercentageGoal || 75;

console.log('=== CURRENT STREAK STATE ===');
console.log(`Count: ${prefs.signalStreakCount}, Points: ${prefs.signalStreakPoints}, Longest: ${prefs.signalStreakLongest}, AlgoVersion: ${prefs.signalStreakAlgoVersion}`);
console.log(`Goal: ${goal}%, Active signals: ${activeSignals.join(', ')}`);
console.log('');

// Fetch 60 days of signal history
const today = new Date();
const start = new Date(today);
start.setDate(start.getDate() - 60);
const startStr = start.toISOString().split('T')[0];
const endStr = today.toISOString().split('T')[0];

const { data: signals } = await supabase
  .from('signals').select('*').eq('user_id', userId)
  .gte('date', startStr).lte('date', endStr).order('date', { ascending: true });

// Group by date
const byDate = {};
for (const s of signals) {
  if (!byDate[s.date]) byDate[s.date] = {};
  byDate[s.date][s.metric] = s.value;
}

// Apply shower 3-day window to a copy
const byDateFixed = JSON.parse(JSON.stringify(byDate));
const allDates = Object.keys(byDateFixed).sort();
for (const dateStr of allDates) {
  const sv = byDateFixed[dateStr]?.shower;
  if (sv === true || sv === 'true' || sv === 1 || sv === '1') continue;
  const d = new Date(dateStr + 'T12:00:00Z');
  for (let i = 1; i <= 2; i++) {
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - i);
    const prevStr = prev.toISOString().split('T')[0];
    const ps = byDateFixed[prevStr]?.shower;
    if (ps === true || ps === 'true' || ps === 1 || ps === '1') {
      if (!byDateFixed[dateStr]) byDateFixed[dateStr] = {};
      byDateFixed[dateStr].shower = 1;
      break;
    }
  }
}

function computeScore(daySignals, activeList, goals, goalThreshold) {
  let totalActive = 0, totalScore = 0, allMeet = true;
  const evalSignals = activeList.filter(k => daySignals[k] !== undefined && daySignals[k] !== null);
  for (const key of evalSignals) {
    totalActive++;
    const value = daySignals[key];
    let score = 0;
    if (value === true || value === 'true' || value === 1 || value === '1') score = 100;
    else if (value === false || value === 'false' || value === 0 || value === '0') score = 0;
    else if (typeof value === 'number') {
      if (key in goals) {
        const g = goals[key];
        if (key === 'minutesToOffice') score = value <= g ? 100 : Math.max(0, 100 - ((value - g) / g) * 100);
        else score = value >= g ? 100 : (value / g) * 100;
      } else score = (value / 5) * 100;
    }
    if (score < goalThreshold) allMeet = false;
    totalScore += score;
  }
  if (totalActive === 0) return 0;
  if (allMeet && totalActive > 0) return 100;
  return Math.round(totalScore / totalActive);
}

// Walk the streak for both versions
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];

// Generate all dates from earliest data to yesterday
const datesWithData = Object.keys(byDate).sort();
if (datesWithData.length === 0) { console.log('No data found'); process.exit(0); }
const earliest = datesWithData[0];
const allWalkDates = [];
const cur = new Date(earliest + 'T12:00:00Z');
const end = new Date(yesterdayStr + 'T12:00:00Z');
while (cur <= end) {
  allWalkDates.push(cur.toISOString().split('T')[0]);
  cur.setUTCDate(cur.getUTCDate() + 1);
}

console.log('=== DAY-BY-DAY SCORES ===');
console.log('Date         | Old Score | Fixed Score | Shower DB | Shower Fixed');
console.log('-------------|-----------|-------------|-----------|-------------');

let oldStreak = 0, oldPoints = 0, oldMax = 0;
let fixStreak = 0, fixPoints = 0, fixMax = 0;

for (const dateStr of allWalkDates) {
  const oldScore = byDate[dateStr] ? computeScore(byDate[dateStr], activeSignals, signalGoals, goal) : 0;
  const fixScore = byDateFixed[dateStr] ? computeScore(byDateFixed[dateStr], activeSignals, signalGoals, goal) : 0;

  const showerDB = byDate[dateStr]?.shower;
  const showerFix = byDateFixed[dateStr]?.shower;

  // Old streak walk
  if (oldScore >= goal) {
    oldStreak++;
    oldPoints += Math.max(0, oldScore - goal);
  } else if (oldPoints >= 100) {
    oldPoints = Math.max(0, oldPoints - 100);
  } else {
    oldStreak = 0; oldPoints = 0;
  }
  if (oldStreak > oldMax) oldMax = oldStreak;

  // Fixed streak walk
  if (fixScore >= goal) {
    fixStreak++;
    fixPoints += Math.max(0, fixScore - goal);
  } else if (fixPoints >= 100) {
    fixPoints = Math.max(0, fixPoints - 100);
  } else {
    fixStreak = 0; fixPoints = 0;
  }
  if (fixStreak > fixMax) fixMax = fixStreak;

  const oldMark = oldScore >= goal ? '✓' : '✗';
  const fixMark = fixScore >= goal ? '✓' : '✗';
  const showerDBStr = showerDB === undefined ? '-' : String(showerDB);
  const showerFixStr = showerFix === undefined ? '-' : String(showerFix);

  console.log(`${dateStr} | ${String(oldScore).padStart(3)}% ${oldMark} S:${oldStreak}/P:${Math.round(oldPoints)} | ${String(fixScore).padStart(3)}% ${fixMark} S:${fixStreak}/P:${Math.round(fixPoints)} | ${showerDBStr.padStart(9)} | ${showerFixStr}`);
}

// Today's score
const todayStr = today.toISOString().split('T')[0];
const todayOld = byDate[todayStr] ? computeScore(byDate[todayStr], activeSignals, signalGoals, goal) : 0;
const todayFix = byDateFixed[todayStr] ? computeScore(byDateFixed[todayStr], activeSignals, signalGoals, goal) : 0;
console.log(`${todayStr} | ${String(todayOld).padStart(3)}% ${todayOld >= goal ? '✓' : '✗'} (today) | ${String(todayFix).padStart(3)}% ${todayFix >= goal ? '✓' : '✗'} (today)`);

console.log('');
console.log('=== STREAK SUMMARY ===');
console.log(`Without shower fix: streak=${oldStreak} (+today=${oldStreak + (todayOld >= goal ? 1 : 0)}), points=${Math.round(oldPoints)}, longest=${oldMax}`);
console.log(`With shower fix:    streak=${fixStreak} (+today=${fixStreak + (todayFix >= goal ? 1 : 0)}), points=${Math.round(fixPoints)}, longest=${fixMax}`);
