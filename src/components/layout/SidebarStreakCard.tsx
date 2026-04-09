import React from "react";

interface SidebarStreakCardProps {
  streak: number;
  streakDanger: boolean;
  signalScore: number;
  signalGoal: number;
  completedSignals: number;
  totalSignals: number;
  onClick: () => void;
}

const FireIcon: React.FC<{ color: string; glowColor: string; size?: number }> = ({
  color,
  glowColor,
  size = 28,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 1.5C12 1.5 5 8.5 5 14C5 18.1 8.1 21.5 12 21.5C15.9 21.5 19 18.1 19 14C19 8.5 12 1.5 12 1.5Z"
      fill={color}
    />
    <path
      d="M12 9C12 9 8.5 12.5 8.5 15.2C8.5 17.3 10.1 19 12 19C13.9 19 15.5 17.3 15.5 15.2C15.5 12.5 12 9 12 9Z"
      fill={glowColor}
    />
  </svg>
);

function getTheme(goalMet: boolean, isDanger: boolean) {
  if (isDanger) {
    return {
      flame: "#ef4444",
      glow: "#fca5a5",
      number: "text-red-400",
      label: "text-red-400/40",
      bar: "bg-red-500",
      scoreText: "text-red-400",
      scoreSub: "text-slate-500",
      goalMark: "bg-red-400/30",
    };
  }
  if (goalMet) {
    return {
      flame: "#22c55e",
      glow: "#86efac",
      number: "text-emerald-400",
      label: "text-emerald-400/40",
      bar: "bg-emerald-500",
      scoreText: "text-emerald-400",
      scoreSub: "text-slate-500",
      goalMark: "bg-emerald-400/30",
    };
  }
  return {
    flame: "#f97316",
    glow: "#fde047",
    number: "text-orange-400",
    label: "text-orange-400/40",
    bar: "bg-orange-500",
    scoreText: "text-slate-300",
    scoreSub: "text-slate-500",
    goalMark: "bg-slate-400/25",
  };
}

const SidebarStreakCard: React.FC<SidebarStreakCardProps> = ({
  streak,
  streakDanger,
  signalScore,
  signalGoal,
  completedSignals,
  totalSignals,
  onClick,
}) => {
  const goalMet = signalScore >= signalGoal;
  const t = getTheme(goalMet, streakDanger);
  const displayPct = Math.min(signalScore, 100);

  return (
    <div
      onClick={onClick}
      className="rounded-2xl bg-white/[0.04] dark:bg-white/[0.03] border border-white/[0.06] overflow-hidden cursor-pointer transition-all hover:bg-white/[0.06] active:scale-[0.98]"
    >
      {/* ── Streak ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <FireIcon color={t.flame} glowColor={t.glow} size={34} />
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[32px] font-black tabular-nums leading-none tracking-tight ${t.number}`}>
              {streak}
            </span>
            <span className={`text-sm font-semibold ${t.label}`}>
              {streak === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
        {/* Red color on the streak number is sufficient danger indicator */}
      </div>

      {/* ── Progress bar as separator ── */}
      <div className="px-4">
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden relative">
          <div
            className={`absolute top-0 bottom-0 w-0.5 rounded-full ${t.goalMark}`}
            style={{ left: `${signalGoal}%` }}
          />
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${t.bar}`}
            style={{ width: `${displayPct}%` }}
          />
        </div>
      </div>

      {/* ── Signal numbers below bar ── */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-bold tabular-nums leading-none text-white">
              {signalScore}
            </span>
            <span className={`text-[11px] font-semibold ${t.scoreSub}`}>%</span>
          </div>
          <span className={`text-[11px] font-medium tabular-nums ${t.scoreSub}`}>
            {completedSignals} of {totalSignals}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SidebarStreakCard;
