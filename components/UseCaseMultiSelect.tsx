'use client';

const USE_CASES = [
  'SSO',
  'MFA',
  'Social Login',
  'B2C Authentication',
  'User Management',
  'Password Management',
  'B2B Multi-tenancy',
  'Role-Based Access Control',
  'Fine-Grained Permissions',
  'API Security',
  'LLM/AI Authentication',
  'AI Agent Security',
  'Chatbot Authentication',
  'Machine-to-Machine Auth',
  'Compliance & Audit',
];

interface UseCaseMultiSelectProps {
  value: string[];
  onChange: (useCases: string[]) => void;
}

export default function UseCaseMultiSelect({ value, onChange }: UseCaseMultiSelectProps) {
  const toggleUseCase = (useCase: string) => {
    if (value.includes(useCase)) {
      onChange(value.filter(uc => uc !== useCase));
    } else {
      onChange([...value, useCase]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">Use Cases</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
        {USE_CASES.map(useCase => (
          <label
            key={useCase}
            className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={value.includes(useCase)}
              onChange={() => toggleUseCase(useCase)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{useCase}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Selected: {value.length === 0 ? 'None' : value.length}
      </p>
    </div>
  );
}
