import React, { useState, KeyboardEvent } from "react";

interface SignalCardProps {
  label: string;
  type: "binary" | "number" | "water" | "scale";
  value: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | boolean) => void;
}
const SignalCard: React.FC<SignalCardProps> = ({
  label,
  type,
  value,
  min = 0,
  max = 10,
  step = 1,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(Number(tempValue));
      setIsEditing(false);
    }
  };

  const getTimeColor = (minutes: number) => {
    if (minutes <= 15)
      return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200";
    if (minutes <= 30)
      return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200";
    if (minutes <= 45)
      return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200";
    if (minutes <= 60)
      return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200";
    if (minutes <= 120)
      return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
    if (minutes <= 180)
      return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
    return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
  };

  const renderWaterOptions = () => {
    const options = [
      { label: "350ml", value: 350 },
      { label: "1.1L", value: 1100 },
    ];

    return (
      <div className="flex items-center gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange((value as number) + option.value)}
            className="py-1.5 px-3 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
          >
            +{option.label}
          </button>
        ))}
        <div
          onClick={() => setIsEditing(true)}
          className="flex-1 text-center py-1.5 px-2 text-sm font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md cursor-pointer text-gray-800 dark:text-gray-200"
        >
          {isEditing ? (
            <input
              type="number"
              value={tempValue as number}
              onChange={(e) => setTempValue(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                onChange(Number(tempValue));
                setIsEditing(false);
              }}
              className="w-full text-center h-full focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-transparent text-gray-800 dark:text-gray-200"
              autoFocus
            />
          ) : (
            <span className="text-gray-800 dark:text-gray-200">{value}ml</span>
          )}
        </div>
      </div>
    );
  };

  const renderScale = () => {
    const getScaleColor = (num: number) => {
      const colors = {
        1: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200",
        2: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200",
        3: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200",
        4: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200",
        5: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200",
      };
      return (
        colors[num as keyof typeof colors] ||
        "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
      );
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              value === num
                ? getScaleColor(num)
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  const renderNumber = () => {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className={`w-full text-center py-1.5 px-2 text-sm font-medium rounded-md cursor-pointer ${
          isEditing
            ? "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
            : getTimeColor(value as number)
        }`}
      >
        {isEditing ? (
          <input
            type="number"
            value={tempValue as number}
            onChange={(e) => setTempValue(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              onChange(Number(tempValue));
              setIsEditing(false);
            }}
            className="w-full h-6 text-center focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-transparent"
            autoFocus
          />
        ) : (
          <div className="h-6 flex items-center justify-center">
            {value} min
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 p-3 transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      </div>

      {type === "binary" ? (
        <button
          onClick={() => onChange(!value)}
          className={`w-full py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
            value
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          {value ? "Yes" : "No"}
        </button>
      ) : type === "water" ? (
        renderWaterOptions()
      ) : type === "scale" ? (
        renderScale()
      ) : (
        renderNumber()
      )}
    </div>
  );
};

export default SignalCard;
