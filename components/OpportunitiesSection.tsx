'use client';

import { useEffect, useState } from 'react';
import OpportunityCard from './OpportunityCard';

interface LinkedProspect {
  id: number;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  roleType: string | null;
}

interface Opportunity {
  id: number;
  opportunityName: string;
  stage: string | null;
  lastStageChangeDate: string | null;
  businessUseCase: string | null;
  winLossDescription: string | null;
  whyDoAnything: string | null;
  whyDoItNow: string | null;
  whySolveProblem: string | null;
  whyOkta: string | null;
  stepsToClose: string | null;
  economicBuyer: string | null;
  metrics: string | null;
  decisionProcess: string | null;
  paperProcess: string | null;
  identifyPain: string | null;
  decisionCriteria: string | null;
  champions: string | null;
  championTitle: string | null;
  compellingEvent: string | null;
  competition: string | null;
  createdAt: string;
  linkedProspects: LinkedProspect[];
}

export default function OpportunitiesSection({ accountId }: { accountId: number }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/opportunities`);
        if (!res.ok) throw new Error('Failed to fetch opportunities');
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, [accountId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No Salesforce opportunities imported for this account.</p>
        <p className="text-xs mt-1">
          Import opportunity data from the{' '}
          <a href="/import-opportunities" className="text-blue-600 hover:underline">
            Import Opportunities
          </a>{' '}
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Salesforce Opportunities ({opportunities.length})
        </h3>
      </div>
      <div className="space-y-2">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}
