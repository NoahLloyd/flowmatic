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
    if (minutes <= 15) return "bg-emerald-500 text-white";
    if (minutes <= 30) return "bg-green-500 text-white";
    if (minutes <= 45) return "bg-yellow-500 text-black";
    if (minutes <= 60) return "bg-orange-500 text-white";
    if (minutes <= 120) return "bg-red-500 text-white";
    if (minutes <= 180) return "bg-red-600 text-white";
    return "bg-red-700 text-white";
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
            className="py-1.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            +{option.label}
          </button>
        ))}
        <div
          onClick={() => setIsEditing(true)}
          className="flex-1 text-center py-1.5 px-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
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
              className="w-full text-center h-full focus:outline-none bg-transparent dark:text-white"
              autoFocus
            />
          ) : (
            `${value}ml`
          )}
        </div>
      </div>
    );
  };

  const renderScale = () => {
    const getScaleColor = (num: number) => {
      const colors = {
        1: "bg-red-500 hover:bg-red-600",
        2: "bg-orange-500 hover:bg-orange-600",
        3: "bg-yellow-500 hover:bg-yellow-600",
        4: "bg-lime-500 hover:bg-lime-600",
        5: "bg-green-500 hover:bg-green-600",
      };
      return (
        colors[num as keyof typeof colors] ||
        "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
      );
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              value === num
                ? `${getScaleColor(num)} text-white shadow-sm`
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
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
        className={`w-full text-center py-1 px-2 text-sm font-mono rounded-lg cursor-pointer ${
          isEditing
            ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
            className="w-full h-6 text-center focus:outline-none bg-transparent dark:text-white"
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
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </label>
      </div>

      {type === "binary" ? (
        <button
          onClick={() => onChange(!value)}
          className={`w-full py-1.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            value
              ? "bg-indigo-500 text-white shadow-sm hover:bg-indigo-600"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
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
