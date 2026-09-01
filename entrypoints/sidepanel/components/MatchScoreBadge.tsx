import { useMemo } from 'react';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'lg';
}

export default function MatchScoreBadge({ score, size = 'lg' }: MatchScoreBadgeProps) {
  const { colorClass, bgClass, strokeColor } = useMemo(() => {
    if (score >= 75) return { colorClass: 'score-green', bgClass: 'score-bg-green', strokeColor: '#22c55e' };
    if (score >= 50) return { colorClass: 'score-yellow', bgClass: 'score-bg-yellow', strokeColor: '#eab308' };
    return { colorClass: 'score-red', bgClass: 'score-bg-red', strokeColor: '#ef4444' };
  }, [score]);

  const radius = size === 'lg' ? 42 : 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = size === 'lg' ? 100 : 68;
  const strokeWidth = size === 'lg' ? 6 : 4;

  return (
    <div className={`relative inline-flex items-center justify-center rounded-2xl border p-3 ${bgClass}`}>
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-300/40"
        />
        {/* Score arc */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${size === 'lg' ? 'text-2xl' : 'text-lg'} font-bold ${colorClass}`}>
          {score}%
        </span>
        {size === 'lg' && <span className="text-[10px] text-gray-500 uppercase tracking-wider">Match</span>}
      </div>
    </div>
  );
}
