'use client';

const TIER_CONFIG: Record<string, { bg: string; text: string; label: string; strikethrough?: boolean }> = {
  HVT: { bg: 'bg-red-100', text: 'text-red-800', label: 'HVT' },
  MVT: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'MVT' },
  LVT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'LVT' },
  no_longer_with_company: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Left Co.', strikethrough: true },
  recently_changed_roles: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Role Change' },
  gatekeeper: { bg: 'bg-violet-100', text: 'text-violet-800', label: 'Gatekeeper' },
  technical_evaluator: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Tech Eval' },
};

interface Props {
  tier: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function ProspectTierBadge({ tier, size = 'sm' }: Props) {
  if (!tier) return null;

  const config = TIER_CONFIG[tier];
  if (!config) return null;

  const sizeClasses = size === 'md'
    ? 'px-2.5 py-1 text-xs'
    : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-block font-medium rounded-full ${sizeClasses} ${config.bg} ${config.text} ${config.strikethrough ? 'line-through' : ''}`}
    >
      {config.label}
    </span>
  );
}

export { TIER_CONFIG };
