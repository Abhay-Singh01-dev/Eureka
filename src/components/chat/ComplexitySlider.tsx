import React, { type FC } from "react";
import { Sparkles, BookOpen, Rocket } from "lucide-react";
import type { ComplexityLevel, ComplexityOption } from "@/types";

interface ComplexitySliderProps {
  value: ComplexityLevel;
  onChange: (level: ComplexityLevel) => void;
}

const ComplexitySlider: FC<ComplexitySliderProps> = ({ value, onChange }) => {
  const levels: ComplexityOption[] = [
    {
      id: "simple",
      label: "Simple",
      icon: Sparkles,
      color: "text-green-600 bg-green-100",
    },
    {
      id: "balanced",
      label: "Balanced",
      icon: BookOpen,
      color: "text-blue-600 bg-blue-100",
    },
    {
      id: "advanced",
      label: "Advanced",
      icon: Rocket,
      color: "text-purple-600 bg-purple-100",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <span className="text-xs text-gray-500 mr-1">Explain:</span>
      <div className="flex bg-gray-100 rounded-full p-1 gap-1">
        {levels.map((level) => {
          const Icon = level.icon;
          const isActive = value === level.id;

          return (
            <button
              key={level.id}
              onClick={() => onChange(level.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive ? level.color : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{level.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ComplexitySlider;
