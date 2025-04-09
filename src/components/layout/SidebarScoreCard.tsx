import React from "react";
import { Trophy } from "lucide-react";

interface SidebarScoreCardProps {
  title: string;
  value: number | string;
  total?: number | string;
  goal?: number | string;
  percentage: number;
  suffix?: string;
  prefix?: string;
  exceededGoal?: boolean;
  showTrophy?: boolean;
  onClick?: () => void;
  extraDisplay?: string;
  completed?: number;
  progressColor?: "green" | "blue" | "yellow" | "red";
}

const SidebarScoreCard: React.FC<SidebarScoreCardProps> = ({
  title,
  value,
  total,
  goal,
  percentage,
  suffix = "",
  prefix = "",
  exceededGoal = false,
  showTrophy = false,
  onClick,
  extraDisplay,
  completed,
  progressColor,
}) => {
  // For display, cap at 100%
  const displayPercentage = Math.min(percentage, 100);

  // Determine progress color if not provided
  const getProgressColor = () => {
    if (progressColor) return progressColor;

    if (exceededGoal || percentage >= 80) {
      return "green";
    } else if (percentage >= 60) {
      return "blue";
    } else if (percentage >= 40) {
      return "yellow";
    } else {
      return "red";
    }
  };

  const color = getProgressColor();
  const progressColorClasses = {
    green: "bg-green-500 dark:bg-green-600",
    blue: "bg-blue-500 dark:bg-blue-600",
    yellow: "bg-yellow-500 dark:bg-yellow-600",
    red: "bg-red-500 dark:bg-red-600",
  };

  return (
    <div
      onClick={onClick}
      className={`mb-0 px-4 py-3 cursor-pointer rounded-xl border ${
        exceededGoal
          ? "bg-green-50/30 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-white/10 dark:bg-slate-800 border-white/20 dark:border-slate-700"
      } hover:bg-white/15 dark:hover:bg-slate-700/80`}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {title}
          </span>
          {showTrophy && (
            <div className="ml-2">
              <Trophy
                className="w-3 h-3 text-yellow-500 dark:text-yellow-400"
                style={{ display: "inline" }}
              />
            </div>
          )}
        </div>

        <span
          className={`text-xs font-semibold ${
            exceededGoal
              ? "text-green-600 dark:text-green-400"
              : "text-slate-700 dark:text-slate-300"
          }`}
        >
          {prefix}
          {value}
          {suffix}
          {(total || goal) && (
            <span className="text-slate-500 dark:text-slate-400">
              {total
                ? ` (${completed}/${total})`
                : goal
                ? ` / ${goal}${suffix}`
                : ""}
            </span>
          )}
          {extraDisplay && !extraDisplay.includes("0.0") && (
            <span>{extraDisplay}</span>
          )}
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${progressColorClasses[color]}`}
          style={{ width: `${displayPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default SidebarScoreCard;
