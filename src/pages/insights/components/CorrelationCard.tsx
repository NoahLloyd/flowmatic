import React from "react";
import { CorrelationInsight } from "../hooks/useInsightsData";
import { Moon, Dumbbell, Coffee, Battery, CheckCircle2 } from "lucide-react";

interface CorrelationCardProps {
  insight: CorrelationInsight;
}

const CorrelationCard: React.FC<CorrelationCardProps> = ({ insight }) => {
  // Get icon based on insight type
  const getIcon = () => {
    switch (insight.id) {
      case "sleep":
        return <Moon className="w-4 h-4" />;
      case "exercise":
        return <Dumbbell className="w-4 h-4" />;
      case "breakfast":
        return <Coffee className="w-4 h-4" />;
      case "energy":
        return <Battery className="w-4 h-4" />;
      case "signals":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Calculate bar widths
  const maxValue = Math.max(insight.withCondition.value, insight.withoutCondition.value, 0.1);
  const withWidth = (insight.withCondition.value / maxValue) * 100;
  const withoutWidth = (insight.withoutCondition.value / maxValue) * 100;

  const diffText = insight.difference > 0 
    ? `+${insight.difference.toFixed(0)}%` 
    : `${insight.difference.toFixed(0)}%`;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{getIcon()}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {insight.title}
          </span>
        </div>
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            insight.difference > 5
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : insight.difference < -5
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          {diffText}
        </span>
      </div>

      {/* Comparison Bars */}
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {insight.withCondition.label}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {insight.withCondition.value.toFixed(1)}h
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-900 dark:bg-white"
              style={{ width: `${withWidth}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {insight.withoutCondition.label}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {insight.withoutCondition.value.toFixed(1)}h
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-300 dark:bg-gray-600"
              style={{ width: `${withoutWidth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sample size */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        {insight.sampleSize.with + insight.sampleSize.without} days compared
      </p>
    </div>
  );
};

export default CorrelationCard;
