import React from "react";
import { Session } from "../../types/Session";

interface SessionCardProps {
  session: Session;
}

const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  const getFocusColor = (focus: number) => {
    switch (focus) {
      case 5:
        return { bg: "bg-indigo-100", text: "text-indigo-700" };
      case 4:
        return { bg: "bg-green-100", text: "text-green-700" };
      case 3:
        return { bg: "bg-yellow-100", text: "text-yellow-700" };
      case 2:
        return { bg: "bg-orange-100", text: "text-orange-700" };
      default:
        return { bg: "bg-red-100", text: "text-red-700" };
    }
  };

  const focusColors = getFocusColor(session.focus);

  return (
    <div
      key={session.created_at}
      className="bg-white w-full rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${focusColors.bg} ${focusColors.text}`}
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {session.focus === 5
            ? "Flow"
            : session.focus === 4
            ? "Locked-in"
            : session.focus === 3
            ? "Attentive"
            : session.focus === 2
            ? "Browsing"
            : "Distracted"}
        </span>
        <span className="text-sm text-gray-500">{session.minutes} min</span>
      </div>

      {session.notes && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {session.notes}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <div className="inline-flex items-center text-gray-600">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {session.project}
        </div>

        <div className="inline-flex items-center text-gray-600">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {(() => {
            const endTime = new Date(session.created_at);
            const startTime = new Date(
              endTime.getTime() - session.minutes * 60 * 1000
            );
            return `${startTime.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} - ${endTime.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}`;
          })()}
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
