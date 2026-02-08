'use client';

interface PrioritySliderProps {
  value: number;
  onChange: (priority: number) => void;
}

export default function PrioritySlider({ value, onChange }: PrioritySliderProps) {
  const getColor = (val: number) => {
    if (val >= 9) return 'text-red-600';
    if (val >= 7) return 'text-orange-600';
    if (val >= 5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getLabel = (val: number) => {
    if (val >= 9) return 'Critical Priority';
    if (val >= 7) return 'High Priority';
    if (val >= 5) return 'Medium Priority';
    return 'Low Priority';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">Priority Score</label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className={`text-3xl font-bold ${getColor(value)}`}>{value}</span>
          <span className="text-sm text-gray-500">/ 10</span>
        </div>
      </div>
      <p className={`text-sm font-medium ${getColor(value)}`}>
        {getLabel(value)}
      </p>
    </div>
  );
}
