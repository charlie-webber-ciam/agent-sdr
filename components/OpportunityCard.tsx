'use client';

import { useState } from 'react';

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

const stageBadgeColor = (stage: string | null): string => {
  if (!stage) return 'bg-gray-100 text-gray-600';
  const s = stage.toLowerCase();
  if (s.includes('closed won')) return 'bg-green-100 text-green-700';
  if (s.includes('closed lost') || s.includes('closed')) return 'bg-red-100 text-red-700';
  if (s.includes('negotiation') || s.includes('proposal')) return 'bg-blue-100 text-blue-700';
  if (s.includes('qualification') || s.includes('discovery')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

const roleTypeBadge = (roleType: string | null) => {
  if (!roleType) return null;
  const colors: Record<string, string> = {
    champion: 'bg-purple-100 text-purple-700',
    decision_maker: 'bg-blue-100 text-blue-700',
    influencer: 'bg-green-100 text-green-700',
    blocker: 'bg-red-100 text-red-700',
    end_user: 'bg-gray-100 text-gray-600',
    unknown: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors[roleType] || colors.unknown}`}>
      {roleType.replace('_', ' ')}
    </span>
  );
};

export default function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [expanded, setExpanded] = useState(false);

  const hasDiscoveryNotes = opportunity.businessUseCase || opportunity.winLossDescription ||
    opportunity.whyDoAnything || opportunity.whyDoItNow || opportunity.whySolveProblem ||
    opportunity.whyOkta || opportunity.stepsToClose;

  const hasMeddpicc = opportunity.economicBuyer || opportunity.metrics ||
    opportunity.decisionProcess || opportunity.paperProcess ||
    opportunity.identifyPain || opportunity.decisionCriteria ||
    opportunity.champions || opportunity.compellingEvent || opportunity.competition;

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {opportunity.opportunityName}
            </h4>
            {opportunity.lastStageChangeDate && (
              <p className="text-xs text-gray-500 mt-0.5">
                Last updated: {new Date(opportunity.lastStageChangeDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColor(opportunity.stage)}`}>
            {opportunity.stage || 'Unknown'}
          </span>
          {opportunity.linkedProspects.length > 0 && (
            <span className="text-xs text-gray-500">
              {opportunity.linkedProspects.length} contact{opportunity.linkedProspects.length !== 1 ? 's' : ''}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Discovery Notes */}
          {hasDiscoveryNotes && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Discovery Notes</h5>
              <div className="space-y-2 text-sm text-gray-700">
                {opportunity.businessUseCase && (
                  <div><span className="font-medium text-gray-900">Pain/Use Case:</span> {opportunity.businessUseCase}</div>
                )}
                {opportunity.winLossDescription && (
                  <div><span className="font-medium text-gray-900">Win/Loss:</span> {opportunity.winLossDescription}</div>
                )}
                {opportunity.whyDoAnything && (
                  <div><span className="font-medium text-gray-900">Why Do Anything?</span> {opportunity.whyDoAnything}</div>
                )}
                {opportunity.whyDoItNow && (
                  <div><span className="font-medium text-gray-900">Why Do It Now?</span> {opportunity.whyDoItNow}</div>
                )}
                {opportunity.whySolveProblem && (
                  <div><span className="font-medium text-gray-900">Why Solve?</span> {opportunity.whySolveProblem}</div>
                )}
                {opportunity.whyOkta && (
                  <div><span className="font-medium text-gray-900">Why Okta?</span> {opportunity.whyOkta}</div>
                )}
                {opportunity.stepsToClose && (
                  <div><span className="font-medium text-gray-900">Steps to Close:</span> {opportunity.stepsToClose}</div>
                )}
              </div>
            </div>
          )}

          {/* MEDDPICC */}
          {hasMeddpicc && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">MEDDPICC</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                {opportunity.metrics && (
                  <div><span className="font-medium text-gray-900">Metrics:</span> {opportunity.metrics}</div>
                )}
                {opportunity.economicBuyer && (
                  <div><span className="font-medium text-gray-900">Economic Buyer:</span> {opportunity.economicBuyer}</div>
                )}
                {opportunity.decisionCriteria && (
                  <div><span className="font-medium text-gray-900">Decision Criteria:</span> {opportunity.decisionCriteria}</div>
                )}
                {opportunity.decisionProcess && (
                  <div><span className="font-medium text-gray-900">Decision Process:</span> {opportunity.decisionProcess}</div>
                )}
                {opportunity.paperProcess && (
                  <div><span className="font-medium text-gray-900">Paper Process:</span> {opportunity.paperProcess}</div>
                )}
                {opportunity.identifyPain && (
                  <div><span className="font-medium text-gray-900">Pain:</span> {opportunity.identifyPain}</div>
                )}
                {opportunity.champions && (
                  <div>
                    <span className="font-medium text-gray-900">Champions:</span> {opportunity.champions}
                    {opportunity.championTitle && <span className="text-gray-500"> ({opportunity.championTitle})</span>}
                  </div>
                )}
                {opportunity.compellingEvent && (
                  <div><span className="font-medium text-gray-900">Compelling Event:</span> {opportunity.compellingEvent}</div>
                )}
                {opportunity.competition && (
                  <div><span className="font-medium text-gray-900">Competition:</span> {opportunity.competition}</div>
                )}
              </div>
            </div>
          )}

          {/* Linked Contacts */}
          {opportunity.linkedProspects.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Contacts ({opportunity.linkedProspects.length})
              </h5>
              <div className="space-y-1.5">
                {opportunity.linkedProspects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
                    {p.title && <span className="text-gray-500">- {p.title}</span>}
                    {roleTypeBadge(p.roleType)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
