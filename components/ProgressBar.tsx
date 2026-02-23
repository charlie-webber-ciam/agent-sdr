interface ProgressBarProps {
  percentage: number;
  status?: 'active' | 'complete' | 'failed' | 'interrupted';
  height?: 'h-3' | 'h-4';
  duration?: 'duration-300' | 'duration-500' | 'duration-700';
  activeColor?: string;
}

export function ProgressBar({
  percentage,
  status = 'active',
  height = 'h-3',
  duration = 'duration-500',
  activeColor = 'bg-blue-500',
}: ProgressBarProps) {
  const barColor =
    status === 'complete'
      ? 'bg-green-500'
      : status === 'failed'
      ? 'bg-red-500'
      : status === 'interrupted'
      ? 'bg-amber-500'
      : activeColor;

  return (
    <div className={`w-full bg-gray-200 rounded-full ${height}`}>
      <div
        className={`${height} rounded-full transition-all ${duration} ${barColor}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
