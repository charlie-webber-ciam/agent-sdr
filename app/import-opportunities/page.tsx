'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface MatchedAccount {
  accountName: string;
  status: string;
  matchedAccountId?: number;
  matchedAccountName?: string;
}

interface AmbiguousMatch {
  accountName: string;
  candidates?: Array<{
    id: number;
    companyName: string;
    domain: string;
    industry: string;
  }>;
}

interface UnmatchedAccount {
  accountName: string;
}

interface ImportResult {
  jobId: number;
  totalRows: number;
  uniqueOpportunities: number;
  uniqueContacts: number;
  matched: MatchedAccount[];
  unmatched: UnmatchedAccount[];
  ambiguous: AmbiguousMatch[];
  prospectsCreated: number;
  opportunitiesCreated: number;
  championsTagged: number;
}

export default function ImportOpportunitiesPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [resolving, setResolving] = useState(false);
  const [selectedUnmatched, setSelectedUnmatched] = useState<Set<string>>(new Set());
  const [creatingAccounts, setCreatingAccounts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    // Store CSV content for potential resolution later
    const content = await file.text();
    setCsvContent(content);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/opportunities/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleResolve = async () => {
    if (!result || !csvContent) return;

    const entries = Object.entries(resolutions);
    if (entries.length === 0) return;

    setResolving(true);
    try {
      const res = await fetch('/api/opportunities/import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.jobId,
          resolutions: entries.map(([accountName, selectedAccountId]) => ({
            accountName,
            selectedAccountId,
          })),
          csvContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Resolution failed');
      }

      const data = await res.json();

      // Update result with resolved counts
      setResult(prev => prev ? {
        ...prev,
        prospectsCreated: prev.prospectsCreated + data.prospectsCreated,
        opportunitiesCreated: prev.opportunitiesCreated + data.opportunitiesCreated,
        championsTagged: prev.championsTagged + data.championsTagged,
        ambiguous: prev.ambiguous.filter(a => !resolutions[a.accountName]),
      } : null);

      setResolutions({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  const handleCreateAccounts = async () => {
    if (!result || !csvContent || selectedUnmatched.size === 0) return;

    setCreatingAccounts(true);
    setError(null);
    try {
      const res = await fetch('/api/opportunities/import/create-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.jobId,
          accountNames: Array.from(selectedUnmatched),
          csvContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create accounts');
      }

      const data = await res.json();
      const resolved = new Set(selectedUnmatched);

      setResult(prev => prev ? {
        ...prev,
        prospectsCreated: prev.prospectsCreated + data.prospectsCreated,
        opportunitiesCreated: prev.opportunitiesCreated + data.opportunitiesCreated,
        championsTagged: prev.championsTagged + data.championsTagged,
        unmatched: prev.unmatched.filter(u => !resolved.has(u.accountName)),
      } : null);
      setSelectedUnmatched(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create accounts');
    } finally {
      setCreatingAccounts(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Salesforce Opportunities</h1>
        <p className="text-gray-600 mt-1">
          Upload a Salesforce opportunity/contact report CSV. The system will match records to existing accounts,
          import contacts as prospects, and store opportunity data with MEDDPICC fields.
        </p>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          {uploading ? (
            <div>
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Importing opportunities...</p>
              <p className="text-sm text-gray-500 mt-1">Parsing CSV, matching accounts, and importing contacts</p>
            </div>
          ) : (
            <div>
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-700 font-medium">Drop your Salesforce CSV here or click to browse</p>
              <p className="text-sm text-gray-500 mt-1">
                Expected columns: First Name, Last Name, Title, Email, Account Name, Opportunity Name, Stage, MEDDPICC fields
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Rows" value={result.totalRows} />
            <StatCard label="Unique Opportunities" value={result.uniqueOpportunities} />
            <StatCard label="Opportunities Created" value={result.opportunitiesCreated} color="green" />
            <StatCard label="Prospects Created" value={result.prospectsCreated} color="blue" />
            <StatCard label="Matched Accounts" value={result.matched.length} color="green" />
            <StatCard label="Unmatched Accounts" value={result.unmatched.length} color={result.unmatched.length > 0 ? 'red' : 'gray'} />
            <StatCard label="Champions Tagged" value={result.championsTagged} color="purple" />
            <StatCard label="Unique Contacts" value={result.uniqueContacts} />
          </div>

          {/* Matched Accounts */}
          {result.matched.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Matched Accounts ({result.matched.length})</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">CSV Account Name</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Matched To</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Match Type</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.matched.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{m.accountName}</td>
                        <td className="px-4 py-2 text-gray-700">{m.matchedAccountName}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.status === 'exact' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {m.status === 'exact' ? 'Exact' : 'Fuzzy'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {m.matchedAccountId && (
                            <Link href={`/accounts/${m.matchedAccountId}`} className="text-blue-600 hover:underline text-xs">
                              View Account
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ambiguous Matches */}
          {result.ambiguous.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Ambiguous Matches ({result.ambiguous.length})
                <span className="text-sm font-normal text-gray-500 ml-2">Select the correct account for each</span>
              </h2>
              <div className="space-y-3">
                {result.ambiguous.map((a, i) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-medium text-gray-900 mb-2">&quot;{a.accountName}&quot;</p>
                    <div className="space-y-1.5">
                      {a.candidates?.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`resolve-${a.accountName}`}
                            checked={resolutions[a.accountName] === c.id}
                            onChange={() => setResolutions(prev => ({ ...prev, [a.accountName]: c.id }))}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">
                            {c.companyName} <span className="text-gray-400">({c.domain} - {c.industry})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(resolutions).length > 0 && (
                  <button
                    onClick={handleResolve}
                    disabled={resolving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {resolving ? 'Resolving...' : `Confirm ${Object.keys(resolutions).length} Resolution(s)`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Unmatched Accounts */}
          {result.unmatched.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Unmatched Accounts ({result.unmatched.length})</h2>
                <button
                  onClick={handleCreateAccounts}
                  disabled={creatingAccounts || selectedUnmatched.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creatingAccounts
                    ? 'Creating...'
                    : selectedUnmatched.size > 0
                      ? `Create ${selectedUnmatched.size} Account${selectedUnmatched.size !== 1 ? 's' : ''}`
                      : 'Create Accounts'}
                </button>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-red-200 flex items-center justify-between">
                  <p className="text-sm text-red-700">
                    These account names could not be matched. Select some to create minimal account records and import their opportunities.
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-red-700 cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={selectedUnmatched.size === result.unmatched.length && result.unmatched.length > 0}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedUnmatched(new Set(result.unmatched.map(u => u.accountName)));
                        } else {
                          setSelectedUnmatched(new Set());
                        }
                      }}
                      className="w-3.5 h-3.5"
                    />
                    Select All
                  </label>
                </div>
                <div className="divide-y divide-red-100">
                  {result.unmatched.map((u, i) => (
                    <label key={i} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-red-100/50">
                      <input
                        type="checkbox"
                        checked={selectedUnmatched.has(u.accountName)}
                        onChange={e => {
                          setSelectedUnmatched(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(u.accountName);
                            else next.delete(u.accountName);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 text-blue-600"
                      />
                      <span className="text-sm text-red-800">{u.accountName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Import another */}
          <div className="pt-4">
            <button
              onClick={() => {
                setResult(null);
                setError(null);
                setCsvContent(null);
                setResolutions({});
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
            >
              Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-900',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color] || colorClasses.gray}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}
