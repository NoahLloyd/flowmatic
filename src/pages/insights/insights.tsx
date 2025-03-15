import React from "react";
import { Session } from "../../types/Session";
import { BarChart3, Clock, LineChart, Loader2 } from "lucide-react";

interface InsightsProps {
  sessions: Session[];
  isLoadingSessions: boolean;
}

const Insights: React.FC<InsightsProps> = ({ sessions, isLoadingSessions }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8 pt-4">
        <div className="flex justify-center mb-5">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <BarChart3 className="w-8 h-8 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
        <h1 className="text-2xl font-medium text-gray-900 dark:text-white mb-3">
          Insights Coming Soon
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          We're working on powerful analytics to help you understand your
          productivity patterns and focus habits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-md border border-gray-200 dark:border-gray-800">
          <div className="flex items-center mb-3">
            <LineChart className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Focus Trends
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Track your focus scores over time and identify patterns in your
            productivity.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-md border border-gray-200 dark:border-gray-800">
          <div className="flex items-center mb-3">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Time Distribution
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            See how you're spending your time across different projects and
            tasks.
          </p>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center border-t border-gray-200 dark:border-gray-800 pt-4 mt-8">
        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
        We've captured {sessions.length} sessions so far
      </div>
    </div>
  );
};

export default Insights;
