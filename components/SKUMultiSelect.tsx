'use client';

const SKUS = [
  {
    name: 'Core',
    description: 'SSO, MFA, Social Login, User Management, B2C/B2B Auth, API Security',
    color: 'border-purple-300 bg-purple-50',
  },
  {
    name: 'FGA',
    description: 'Fine-Grained Authorization, Permissions as a Service, B2B multi-tenancy',
    color: 'border-indigo-300 bg-indigo-50',
  },
  {
    name: 'Auth for AI',
    description: 'LLM app auth, AI agent security, chatbot authentication',
    color: 'border-pink-300 bg-pink-50',
  },
];

interface SKUMultiSelectProps {
  value: string[];
  onChange: (skus: string[]) => void;
}

export default function SKUMultiSelect({ value, onChange }: SKUMultiSelectProps) {
  const toggleSKU = (sku: string) => {
    if (value.includes(sku)) {
      onChange(value.filter(s => s !== sku));
    } else {
      onChange([...value, sku]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">Auth0 SKUs</label>
      <div className="space-y-3">
        {SKUS.map(sku => (
          <label
            key={sku.name}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              value.includes(sku.name)
                ? `${sku.color} border-opacity-100`
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={value.includes(sku.name)}
              onChange={() => toggleSKU(sku.name)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{sku.name}</div>
              <div className="text-xs text-gray-600 mt-1">{sku.description}</div>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Selected: {value.length === 0 ? 'None' : value.join(', ')}
      </p>
    </div>
  );
}
