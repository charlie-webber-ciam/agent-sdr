'use client';

interface TierSelectorProps {
  value: 'A' | 'B' | 'C' | null;
  onChange: (tier: 'A' | 'B' | 'C' | null) => void;
}

export default function TierSelector({ value, onChange }: TierSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">Account Tier</label>
      <div className="flex gap-3">
        {[
          { tier: 'A' as const, label: 'Tier A', color: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200' },
          { tier: 'B' as const, label: 'Tier B', color: 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200' },
          { tier: 'C' as const, label: 'Tier C', color: 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200' },
        ].map(({ tier, label, color }) => (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
              value === tier
                ? `${color} ring-2 ring-offset-2 ${tier === 'A' ? 'ring-green-500' : tier === 'B' ? 'ring-blue-500' : 'ring-gray-500'}`
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
            value === null
              ? 'bg-red-50 border-red-300 text-red-800 ring-2 ring-offset-2 ring-red-500'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          Clear
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        <strong>A:</strong> Enterprise, high growth, strong fit •
        <strong> B:</strong> Mid-market, moderate fit •
        <strong> C:</strong> Small, limited fit
      </p>
    </div>
  );
}
