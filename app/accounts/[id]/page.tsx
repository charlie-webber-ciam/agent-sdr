'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import MarkdownSection from '@/components/MarkdownSection';
import AccountOverviewTab from '@/components/AccountOverviewTab';
import ProspectTab from '@/components/prospects/ProspectTab';
import ProspectMap from '@/components/prospects/ProspectMap';
import ProspectDetailModal from '@/components/prospects/ProspectDetailModal';
import ProspectEmailModal from '@/components/prospects/ProspectEmailModal';
import type { Prospect } from '@/components/prospects/ProspectTab';
import AccountTags from '@/components/AccountTags';
import AccountNotes from '@/components/AccountNotes';
import TierSelector from '@/components/TierSelector';
import PrioritySlider from '@/components/PrioritySlider';
import UseCaseMultiSelect from '@/components/UseCaseMultiSelect';
import SKUMultiSelect from '@/components/SKUMultiSelect';
import AIAutoCategorizePanel from '@/components/AIAutoCategorizePanel';
import { capitalize, cn, formatDomain } from '@/lib/utils';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import EmailWriter from '@/components/EmailWriter';
import SequenceWriter from '@/components/SequenceWriter';
import PovWriter from '@/components/PovWriter';
import ReportSidebar, { SidebarSection } from '@/components/ReportSidebar';
import OpportunitiesSection from '@/components/OpportunitiesSection';
import ActivitiesSection from '@/components/ActivitiesSection';
import { usePerspective } from '@/lib/perspective-context';
import { useToast } from '@/lib/toast-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { AccountOverviewRecord } from '@/lib/account-overview';

interface AccountDetail {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  status: string;
  // Auth0 CIAM Research
  commandOfMessage: string | null;
  currentAuthSolution: string | null;
  customerBaseInfo: string | null;
  securityIncidents: string | null;
  newsAndFunding: string | null;
  techTransformation: string | null;
  prospects: Array<{
    name: string;
    title: string;
    background?: string;
  }>;
  researchSummary: string | null;
  // Okta Workforce Research
  oktaCurrentIamSolution: string | null;
  oktaWorkforceInfo: string | null;
  oktaSecurityIncidents: string | null;
  oktaNewsAndFunding: string | null;
  oktaTechTransformation: string | null;
  oktaEcosystem: string | null;
  oktaProspects: Array<{
    name: string;
    title: string;
    background?: string;
    location?: 'ANZ' | 'APAC' | 'Global' | 'Unknown';
    isPersona?: boolean;
  }>;
  oktaResearchSummary: string | null;
  oktaOpportunityType: 'net_new' | 'competitive_displacement' | 'expansion' | 'unknown' | null;
  oktaPriorityScore: number | null;
  oktaProcessedAt: string | null;
  // Common fields
  errorMessage: string | null;
  processedAt: string | null;
  // Auth0 SDR fields
  tier: 'A' | 'B' | 'C' | null;
  estimatedAnnualRevenue: string | null;
  estimatedUserVolume: string | null;
  useCases: string[];
  auth0Skus: string[];
  sdrNotes: string | null;
  priorityScore: number | null;
  lastEditedAt: string | null;
  aiSuggestions: any | null;
  auth0AccountOwner: string | null;
  researchModel: string | null;
  // Okta SDR fields
  oktaTier: 'A' | 'B' | 'C' | null;
  oktaEstimatedAnnualRevenue: string | null;
  oktaEstimatedUserVolume: string | null;
  oktaUseCases: string[];
  oktaSkus: string[];
  oktaSdrNotes: string | null;
  oktaLastEditedAt: string | null;
  oktaAiSuggestions: any | null;
  oktaPatch: string | null;
  // Triage fields
  triageAuth0Tier: 'A' | 'B' | 'C' | null;
  triageOktaTier: 'A' | 'B' | 'C' | 'DQ' | null;
  triageSummary: string | null;
  triageData: {
    auth0_tier_reasoning: string;
    okta_tier_reasoning: string;
    estimated_arr: string;
    estimated_employees: string;
    key_signals: string[];
  } | null;
  triagedAt: string | null;
  // Review workflow status
  reviewStatus: 'new' | 'reviewed' | 'working' | 'dismissed';
  reviewStatusUpdatedAt: string | null;
  // Enrichment data
  tags: Array<{ id: number; tag: string; tagType: string; createdAt: string }>;
  sectionComments: Record<string, string>;
  notes: Array<{ id: number; content: string; createdAt: string; updatedAt: string }>;
  documents: Array<{
    id: number;
    filename: string;
    mimeType: string | null;
    fileSizeBytes: number;
    processingStatus: 'processing' | 'ready' | 'failed';
    extractionError: string | null;
    contextMarkdown: string | null;
    uploadedAt: string;
    updatedAt: string;
    downloadUrl: string;
  }>;
  prospectCount: number;
  overview: AccountOverviewRecord;
  keyPeople: Array<{
    id: number;
    first_name: string;
    last_name: string;
    title: string | null;
    email: string | null;
    linkedin_url: string | null;
    department: string | null;
    notes: string | null;
    role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown' | null;
    relationship_status: 'new' | 'engaged' | 'warm' | 'cold';
    source: 'manual' | 'salesforce_import' | 'ai_research';
    updated_at: string;
  }>;
}

// Icon components
const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const NewspaperIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);

const LightningIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const MessageIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m7-3c0 4.418-3.582 8-8 8a8.96 8.96 0 01-4.126-.998L4 19l1.082-3.245A7.965 7.965 0 014 11c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
  </svg>
);

// Small icons for sidebar (4x4)
const SmallLockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const SmallUsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SmallShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SmallNewspaperIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);

const SmallLightningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const SmallTargetIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const SmallMessageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m7-3c0 4.418-3.582 8-8 8a8.96 8.96 0 01-4.126-.998L4 19l1.082-3.245A7.965 7.965 0 014 11c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
  </svg>
);

const SmallProspectsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

function getInitialActiveTab(tab: string | null): 'overview' | 'research' | 'prospects' | 'map' | 'opportunities' | 'activities' {
  switch (tab) {
    case 'research':
    case 'prospects':
    case 'map':
    case 'opportunities':
    case 'activities':
    case 'overview':
      return tab;
    default:
      return 'overview';
  }
}

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { perspective, oktaPatch } = usePerspective();
  const toast = useToast();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Top-level tab: Overview, Research, Prospects, Map, Opportunities, or Activities
  const [activeTab, setActiveTab] = useState<'overview' | 'research' | 'prospects' | 'map' | 'opportunities' | 'activities'>(
    getInitialActiveTab(searchParams.get('tab'))
  );

  // Perspective state for research view (local to this page, initialized from global)
  const [activePerspective, setActivePerspective] = useState<'auth0' | 'okta'>(perspective === 'okta' ? 'okta' : 'auth0');

  // Sync local perspective when global perspective changes (e.g. after hydration from localStorage)
  useEffect(() => {
    setActivePerspective(perspective === 'okta' ? 'okta' : 'auth0');
  }, [perspective]);

  // Scroll-spy state
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Categorization panel state (collapsed by default)
  const [showCategorization, setShowCategorization] = useState(false);

  // Mobile TOC state
  const [showMobileToc, setShowMobileToc] = useState(false);

  // Auth0 Editing state
  const [isEditingAuth0, setIsEditingAuth0] = useState(false);
  const [showAuth0AISuggestions, setShowAuth0AISuggestions] = useState(false);
  const [savingAuth0, setSavingAuth0] = useState(false);

  // Okta Editing state
  const [isEditingOkta, setIsEditingOkta] = useState(false);
  const [showOktaAISuggestions, setShowOktaAISuggestions] = useState(false);
  const [savingOkta, setSavingOkta] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Retry state
  const [isRetrying, setIsRetrying] = useState(false);

  // Reprocess state
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Map tab prospect modal state
  const [mapSelectedProspect, setMapSelectedProspect] = useState<Prospect | null>(null);
  const [mapEmailingProspect, setMapEmailingProspect] = useState<Prospect | null>(null);
  const [mapProspects, setMapProspects] = useState<Prospect[]>([]);

  // Enrichment state
  const [tags, setTags] = useState<AccountDetail['tags']>([]);
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<AccountDetail['notes']>([]);
  const [runningSections, setRunningSections] = useState<Set<string>>(new Set());

  // Unsaved changes confirmation modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);

  // Auth0 edit data
  const [auth0EditData, setAuth0EditData] = useState({
    tier: null as 'A' | 'B' | 'C' | null,
    estimatedAnnualRevenue: '',
    estimatedUserVolume: '',
    useCases: [] as string[],
    auth0Skus: [] as string[],
    sdrNotes: '',
    priorityScore: 5,
  });

  // Okta edit data
  const [oktaEditData, setOktaEditData] = useState({
    oktaTier: null as 'A' | 'B' | 'C' | null,
    oktaEstimatedAnnualRevenue: '',
    oktaEstimatedUserVolume: '',
    oktaUseCases: [] as string[],
    oktaSkus: [] as string[],
    oktaSdrNotes: '',
  });

  // ─── Unsaved Changes Detection ──────────────────────────────────────
  const hasUnsavedChanges = useMemo(() => {
    if (!account) return false;
    if (isEditingAuth0) {
      return (
        auth0EditData.tier !== (account.tier || null) ||
        auth0EditData.estimatedAnnualRevenue !== (account.estimatedAnnualRevenue || '') ||
        auth0EditData.estimatedUserVolume !== (account.estimatedUserVolume || '') ||
        auth0EditData.sdrNotes !== (account.sdrNotes || '') ||
        auth0EditData.priorityScore !== (account.priorityScore || 5) ||
        JSON.stringify(auth0EditData.useCases) !== JSON.stringify(account.useCases || []) ||
        JSON.stringify(auth0EditData.auth0Skus) !== JSON.stringify(account.auth0Skus || [])
      );
    }
    if (isEditingOkta) {
      return (
        oktaEditData.oktaTier !== (account.oktaTier || null) ||
        oktaEditData.oktaEstimatedAnnualRevenue !== (account.oktaEstimatedAnnualRevenue || '') ||
        oktaEditData.oktaEstimatedUserVolume !== (account.oktaEstimatedUserVolume || '') ||
        oktaEditData.oktaSdrNotes !== (account.oktaSdrNotes || '') ||
        JSON.stringify(oktaEditData.oktaUseCases) !== JSON.stringify(account.oktaUseCases || []) ||
        JSON.stringify(oktaEditData.oktaSkus) !== JSON.stringify(account.oktaSkus || [])
      );
    }
    return false;
  }, [account, isEditingAuth0, isEditingOkta, auth0EditData, oktaEditData]);

  // Warn on browser navigation (refresh, close tab) when edits are pending
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Preserve the list filter params so "Back" and prev/next retain filter context.
  // These params were forwarded from the accounts list page URL.
  const listFilterQuery = useMemo(() => {
    const DETAIL_ONLY_KEYS = new Set(['tab']);
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (!DETAIL_ONLY_KEYS.has(key)) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [searchParams]);

  const backToListUrl = listFilterQuery
    ? `/accounts?${listFilterQuery}`
    : '/accounts';

  const buildDetailUrl = useCallback((accountId: number) => {
    return listFilterQuery
      ? `/accounts/${accountId}?${listFilterQuery}`
      : `/accounts/${accountId}`;
  }, [listFilterQuery]);

  // Navigation guard: intercept in-app navigation when there are unsaved changes
  const guardedNavigate = useCallback((url: string) => {
    if (hasUnsavedChanges) {
      pendingNavigationRef.current = url;
      setShowUnsavedModal(true);
    } else {
      router.push(url);
    }
  }, [hasUnsavedChanges, router]);

  const handleConfirmDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    // Reset edit states
    setIsEditingAuth0(false);
    setIsEditingOkta(false);
    if (pendingNavigationRef.current) {
      router.push(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  }, [router]);

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedModal(false);
    pendingNavigationRef.current = null;
  }, []);

  // ─── Prev/Next Navigation ────────────────────────────────────────────
  const [neighbors, setNeighbors] = useState<{
    prevId: number | null;
    prevName: string | null;
    nextId: number | null;
    nextName: string | null;
    position: number;
    total: number;
  } | null>(null);

  // Fetch prev/next neighbors based on the referring page's filters
  const fetchNeighbors = useCallback(async () => {
    try {
      // Carry over the filter params from the accounts list URL
      const params = new URLSearchParams(window.location.search);
      // Also pass the referring page's search params if stored
      const referrer = document.referrer;
      if (referrer && referrer.includes('/accounts')) {
        try {
          const refUrl = new URL(referrer);
          refUrl.searchParams.forEach((value, key) => {
            if (key !== 'page' && !params.has(key)) {
              params.set(key, value);
            }
          });
        } catch {}
      }
      params.set('currentId', id);
      const res = await fetch(`/api/accounts/neighbors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNeighbors(data);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchNeighbors();
  }, [fetchNeighbors]);

  // Keyboard shortcuts: left/right arrow for prev/next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === 'ArrowLeft' && neighbors?.prevId) {
        e.preventDefault();
        guardedNavigate(buildDetailUrl(neighbors.prevId));
      } else if (e.key === 'ArrowRight' && neighbors?.nextId) {
        e.preventDefault();
        guardedNavigate(buildDetailUrl(neighbors.nextId));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [neighbors, guardedNavigate, buildDetailUrl]);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch account');
      }
      const data = await res.json();
      setAccount(data);
      setError(null);

      // Initialize Auth0 edit data
      setAuth0EditData({
        tier: data.tier || null,
        estimatedAnnualRevenue: data.estimatedAnnualRevenue || '',
        estimatedUserVolume: data.estimatedUserVolume || '',
        useCases: data.useCases || [],
        auth0Skus: data.auth0Skus || [],
        sdrNotes: data.sdrNotes || '',
        priorityScore: data.priorityScore || 5,
      });

      // Initialize enrichment data
      setTags(data.tags || []);
      setSectionComments(data.sectionComments || {});
      setNotes(data.notes || []);

      // Initialize Okta edit data
      setOktaEditData({
        oktaTier: data.oktaTier || null,
        oktaEstimatedAnnualRevenue: data.oktaEstimatedAnnualRevenue || '',
        oktaEstimatedUserVolume: data.oktaEstimatedUserVolume || '',
        oktaUseCases: data.oktaUseCases || [],
        oktaSkus: data.oktaSkus || [],
        oktaSdrNotes: data.oktaSdrNotes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  // Fetch prospects for the map tab modals
  const fetchMapProspects = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${id}/prospects`);
      if (res.ok) {
        const data = await res.json();
        setMapProspects(data.prospects);
      }
    } catch {}
  }, [id]);

  // Scroll-spy with IntersectionObserver
  useEffect(() => {
    const sectionIds = [
      'section-command', 'section-summary', 'section-auth', 'section-users', 'section-security',
      'section-news', 'section-tech', 'section-ecosystem', 'section-prospects',
      'section-notes', 'section-email', 'section-sequence', 'section-pov',
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-100px 0px -60% 0px',
        threshold: 0,
      }
    );

    // Small delay to let DOM render
    const timer = setTimeout(() => {
      sectionIds.forEach((sectionId) => {
        const el = document.getElementById(sectionId);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [account, activePerspective]);

  // Build sidebar sections based on perspective
  const sidebarSections: SidebarSection[] = useMemo(() => {
    if (!account) return [];

    if (activePerspective === 'auth0') {
      return [
        { id: 'section-command', label: 'Command Of Message', icon: <SmallMessageIcon /> },
        { id: 'section-summary', label: 'Executive Summary', icon: <SmallTargetIcon /> },
        { id: 'section-auth', label: 'Auth Solution', icon: <SmallLockIcon /> },
        { id: 'section-users', label: 'Customer Base', icon: <SmallUsersIcon /> },
        { id: 'section-security', label: 'Security & Compliance', icon: <SmallShieldIcon /> },
        { id: 'section-news', label: 'News & Funding', icon: <SmallNewspaperIcon /> },
        { id: 'section-tech', label: 'Tech Transformation', icon: <SmallLightningIcon /> },
        { id: 'section-prospects', label: 'Prospects', icon: <SmallProspectsIcon /> },
      ];
    } else {
      return [
        { id: 'section-summary', label: 'Executive Summary', icon: <SmallTargetIcon /> },
        { id: 'section-auth', label: 'IAM Solution', icon: <SmallLockIcon /> },
        { id: 'section-users', label: 'Workforce & IT', icon: <SmallUsersIcon /> },
        { id: 'section-security', label: 'Security & Compliance', icon: <SmallShieldIcon /> },
        { id: 'section-news', label: 'News & Funding', icon: <SmallNewspaperIcon /> },
        { id: 'section-tech', label: 'Tech Transformation', icon: <SmallLightningIcon /> },
        { id: 'section-ecosystem', label: 'Okta Ecosystem', icon: <SmallTargetIcon /> },
        { id: 'section-prospects', label: 'Prospects', icon: <SmallProspectsIcon /> },
      ];
    }
  }, [account, activePerspective]);

  // Auth0 Edit Handlers
  const handleEditAuth0 = () => {
    setIsEditingAuth0(true);
    setShowAuth0AISuggestions(false);
  };

  const handleCancelAuth0 = () => {
    if (account) {
      setAuth0EditData({
        tier: account.tier || null,
        estimatedAnnualRevenue: account.estimatedAnnualRevenue || '',
        estimatedUserVolume: account.estimatedUserVolume || '',
        useCases: account.useCases || [],
        auth0Skus: account.auth0Skus || [],
        sdrNotes: account.sdrNotes || '',
        priorityScore: account.priorityScore || 5,
      });
    }
    setIsEditingAuth0(false);
  };

  const handleSaveAuth0 = async () => {
    setSavingAuth0(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: auth0EditData.tier,
          estimatedAnnualRevenue: auth0EditData.estimatedAnnualRevenue,
          estimatedUserVolume: auth0EditData.estimatedUserVolume,
          useCases: auth0EditData.useCases,
          auth0Skus: auth0EditData.auth0Skus,
          sdrNotes: auth0EditData.sdrNotes,
          priorityScore: auth0EditData.priorityScore,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save Auth0 changes');
      }

      await loadAccount();
      setIsEditingAuth0(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Auth0 changes');
    } finally {
      setSavingAuth0(false);
    }
  };

  const handleAuth0AISuggest = () => {
    setShowAuth0AISuggestions(true);
    setIsEditingAuth0(false);
  };

  const handleAcceptAuth0AISuggestions = (suggestions: any) => {
    setAuth0EditData({
      tier: suggestions.tier || auth0EditData.tier,
      estimatedAnnualRevenue: suggestions.estimatedAnnualRevenue || auth0EditData.estimatedAnnualRevenue,
      estimatedUserVolume: suggestions.estimatedUserVolume || auth0EditData.estimatedUserVolume,
      useCases: suggestions.useCases || auth0EditData.useCases,
      auth0Skus: suggestions.auth0Skus || auth0EditData.auth0Skus,
      sdrNotes: auth0EditData.sdrNotes,
      priorityScore: suggestions.priorityScore || auth0EditData.priorityScore,
    });
    setShowAuth0AISuggestions(false);
    setIsEditingAuth0(true);
  };

  // Okta Edit Handlers
  const handleEditOkta = () => {
    setIsEditingOkta(true);
    setShowOktaAISuggestions(false);
  };

  const handleCancelOkta = () => {
    if (account) {
      setOktaEditData({
        oktaTier: account.oktaTier || null,
        oktaEstimatedAnnualRevenue: account.oktaEstimatedAnnualRevenue || '',
        oktaEstimatedUserVolume: account.oktaEstimatedUserVolume || '',
        oktaUseCases: account.oktaUseCases || [],
        oktaSkus: account.oktaSkus || [],
        oktaSdrNotes: account.oktaSdrNotes || '',
      });
    }
    setIsEditingOkta(false);
  };

  const handleSaveOkta = async () => {
    setSavingOkta(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(oktaEditData),
      });

      if (!res.ok) {
        throw new Error('Failed to save Okta changes');
      }

      await loadAccount();
      setIsEditingOkta(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Okta changes');
    } finally {
      setSavingOkta(false);
    }
  };

  const handleOktaAISuggest = () => {
    setShowOktaAISuggestions(true);
    setIsEditingOkta(false);
  };

  const handleAcceptOktaAISuggestions = (suggestions: any) => {
    setOktaEditData({
      oktaTier: suggestions.tier || oktaEditData.oktaTier,
      oktaEstimatedAnnualRevenue: suggestions.estimatedAnnualRevenue || oktaEditData.oktaEstimatedAnnualRevenue,
      oktaEstimatedUserVolume: suggestions.estimatedEmployeeCount || oktaEditData.oktaEstimatedUserVolume,
      oktaUseCases: suggestions.useCases || oktaEditData.oktaUseCases,
      oktaSkus: suggestions.oktaSkus || oktaEditData.oktaSkus,
      oktaSdrNotes: oktaEditData.oktaSdrNotes,
    });
    setShowOktaAISuggestions(false);
    setIsEditingOkta(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete account');
      }

      // Redirect to accounts list after successful deletion, preserving filter context
      const deleteParams = new URLSearchParams(listFilterQuery);
      deleteParams.set('deleted', 'true');
      router.push(`/accounts?${deleteParams.toString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/accounts/${id}/retry`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry account');
      }

      const data = await res.json();
      // Redirect to processing page
      router.push(data.redirectUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry account');
      setIsRetrying(false);
    }
  };

  const handleReprocess = async (researchType: 'both' | 'auth0' | 'okta', model?: string) => {
    setIsReprocessing(true);
    try {
      const res = await fetch(`/api/accounts/${id}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ researchType, model }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reprocess account');
      }

      const data = await res.json();
      // Redirect to processing page
      router.push(data.redirectUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reprocess account');
      setIsReprocessing(false);
    }
  };

  // ─── Comment Handlers ────────────────────────────────────────────────────
  const handleCommentSave = useCallback(async (perspective: 'auth0' | 'okta', sectionKey: string, content: string) => {
    const res = await fetch(`/api/accounts/${id}/comments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perspective, sectionKey, content }),
    });
    if (res.ok) {
      setSectionComments(prev => ({ ...prev, [`${perspective}:${sectionKey}`]: content }));
    }
  }, [id]);

  const handleCommentDelete = useCallback(async (perspective: 'auth0' | 'okta', sectionKey: string) => {
    const res = await fetch(`/api/accounts/${id}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perspective, sectionKey }),
    });
    if (res.ok) {
      setSectionComments(prev => {
        const next = { ...prev };
        delete next[`${perspective}:${sectionKey}`];
        return next;
      });
    }
  }, [id]);

  // ─── Section Re-run Handler ──────────────────────────────────────────────
  const handleSectionRerun = useCallback(async (sections: string[], additionalContext: string) => {
    if (!account) return;
    setRunningSections(prev => new Set([...prev, ...sections]));
    try {
      const res = await fetch(`/api/accounts/${id}/rerun-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perspective: activePerspective,
          sections,
          additionalContext: additionalContext || undefined,
        }),
      });
      if (res.ok) {
        await loadAccount();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to re-run section');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-run section');
    } finally {
      setRunningSections(prev => {
        const next = new Set(prev);
        sections.forEach(s => next.delete(s));
        return next;
      });
    }
  }, [id, account, activePerspective, loadAccount]);

  // Section key maps for re-run
  const auth0SectionKeys = ['command_of_message', 'current_auth_solution', 'customer_base_info', 'security_incidents', 'news_and_funding', 'tech_transformation', 'prospects'];
  const oktaSectionKeys = ['okta_current_iam_solution', 'okta_workforce_info', 'okta_security_incidents', 'okta_news_and_funding', 'okta_tech_transformation', 'okta_ecosystem', 'okta_prospects'];

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl">
        <div className="mb-8">
          {/* Back + Prev/Next skeleton */}
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>

          {/* Header card skeleton */}
          <Card className="border-border/70 shadow-lg">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Skeleton className="mb-3 h-10 w-80" />
                  <div className="mb-3 flex items-center gap-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="mb-3 flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-16 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-64" />
            </CardContent>
          </Card>
        </div>

        {/* Tab bar skeleton */}
        <Skeleton className="mb-6 h-11 w-full rounded-lg" />

        {/* Content skeleton */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-8 w-64" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-2 h-4 w-4/6" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-8 w-56" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-8 w-48" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-2 h-4 w-3/5" />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className="mx-auto max-w-7xl">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <h2 className="mb-2 text-xl font-semibold text-destructive">Error</h2>
            <p className="text-destructive/90">{error || 'Account not found'}</p>
            <Button
              className="mt-4"
              variant="destructive"
              onClick={() => router.push(backToListUrl)}
            >
              Back to Accounts
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not processed';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasAuth0Research = !!account.processedAt;
  const hasOktaResearch = !!account.oktaProcessedAt;

  return (
    <main className="mx-auto max-w-7xl">
      {/* Header — full width above the two columns */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => guardedNavigate(backToListUrl)}
            className="gap-2 px-0 text-primary hover:text-primary"
          >
            &larr; Back to Accounts
          </Button>

          {/* Prev / Next Navigation */}
          {neighbors && neighbors.total > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => neighbors.prevId && guardedNavigate(buildDetailUrl(neighbors.prevId))}
                disabled={!neighbors.prevId}
                className="gap-1.5"
                title={neighbors.prevName ? `Previous: ${neighbors.prevName} (←)` : undefined}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </Button>

              <span className="px-2 text-sm text-muted-foreground tabular-nums">
                {neighbors.position} / {neighbors.total}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => neighbors.nextId && guardedNavigate(buildDetailUrl(neighbors.nextId))}
                disabled={!neighbors.nextId}
                className="gap-1.5"
                title={neighbors.nextName ? `Next: ${neighbors.nextName} (→)` : undefined}
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          )}
        </div>

        <Card className="border-border/70 bg-gradient-to-br from-card to-muted/20 shadow-lg">
          <CardContent className="p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="mb-2 text-4xl font-bold">{account.companyName}</h1>
              <div className="mb-3 flex items-center gap-3 text-lg text-muted-foreground">
                <span className="font-medium">{formatDomain(account.domain)}</span>
                <span>&bull;</span>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                  {account.industry}
                </Badge>
                {account.auth0AccountOwner && (
                  <>
                    <span>&bull;</span>
                    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {account.auth0AccountOwner}
                    </Badge>
                  </>
                )}
              </div>

              {/* Account Tags */}
              <div className="mb-3">
                <AccountTags accountId={account.id} tags={tags} onTagsChange={setTags} />
              </div>

              {/* Review Status Selector */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Review:</span>
                {(['new', 'working', 'reviewed', 'dismissed'] as const).map((rs) => {
                  const isActive = (account.reviewStatus || 'new') === rs;
                  const styles: Record<string, string> = {
                    new: isActive ? 'border-zinc-400 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                    working: isActive ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'hover:bg-amber-50 dark:hover:bg-amber-950',
                    reviewed: isActive ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950',
                    dismissed: isActive ? 'border-red-300 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'hover:bg-red-50 dark:hover:bg-red-950',
                  };
                  const labels: Record<string, string> = { new: 'New', working: 'Working', reviewed: 'Reviewed', dismissed: 'Dismissed' };
                  return (
                    <button
                      key={rs}
                      className={cn(
                        'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors cursor-pointer',
                        isActive ? styles[rs] : `border-border text-muted-foreground ${styles[rs]}`
                      )}
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/accounts/${account.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reviewStatus: rs }),
                          });
                          if (res.ok) {
                            setAccount((prev) => prev ? { ...prev, reviewStatus: rs, reviewStatusUpdatedAt: new Date().toISOString() } : prev);
                          }
                        } catch { /* ignore */ }
                      }}
                    >
                      {labels[rs]}
                    </button>
                  );
                })}
              </div>

              {/* Tier, SKU, Priority Badges + Research Status Indicators */}
              <div className="flex flex-wrap gap-2 items-center">
                {(() => {
                  const tier = activePerspective === 'okta' ? account.oktaTier : account.tier;
                  const skus = activePerspective === 'okta' ? account.oktaSkus : account.auth0Skus;
                  const priority = activePerspective === 'okta' ? account.oktaPriorityScore : account.priorityScore;
                  return (
                    <>
                      {tier && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-3 py-1 text-sm font-semibold',
                            tier === 'A' && 'border-emerald-300 bg-emerald-100 text-emerald-800',
                            tier === 'B' && 'border-blue-300 bg-blue-100 text-blue-800',
                            tier === 'C' && 'border-slate-300 bg-slate-100 text-slate-800'
                          )}
                        >
                          Tier {tier}
                        </Badge>
                      )}
                      {skus && skus.map(sku => (
                        <Badge key={sku} variant="outline" className="border-violet-300 bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800">
                          {sku}
                        </Badge>
                      ))}
                      {priority !== null && priority >= 7 && (
                        <Badge variant="outline" className="border-red-300 bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                          Priority {priority}/10
                        </Badge>
                      )}
                    </>
                  );
                })()}
                {/* Research status badges */}
                {account.status === 'completed' && (
                  <>
                    <span className="ml-2 text-muted-foreground/40">|</span>
                    <Badge variant="outline" className={cn(
                      hasAuth0Research ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    )}>
                      Auth0 {hasAuth0Research ? 'Done' : 'N/A'}
                    </Badge>
                    <Badge variant="outline" className={cn(
                      hasOktaResearch ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                    )}>
                      Okta {hasOktaResearch ? 'Done' : 'N/A'}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'px-4 py-2 text-sm font-semibold shadow-sm',
                account.status === 'completed'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : account.status === 'failed'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              )}
            >
              {capitalize(account.status)}
            </Badge>
          </div>

          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Processed: {formatDate(account.processedAt)}
            {account.researchModel && (
              <Badge variant="outline" className="text-xs font-medium">
                {account.researchModel}
              </Badge>
            )}
          </p>

          {account.errorMessage && (
            <Card className="mt-4 border-red-200 bg-red-50">
              <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-red-700 font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error:
                  </p>
                  <p className="text-red-600 text-sm mt-1 ml-7">{account.errorMessage}</p>
                </div>
                {account.status === 'failed' && (
                  <Button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    variant="secondary"
                    className="ml-4 gap-2 bg-yellow-600 text-white hover:bg-yellow-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isRetrying ? 'Retrying...' : 'Retry Research'}
                  </Button>
                )}
              </div>
              </CardContent>
            </Card>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Research / Prospects Tab Bar */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'overview' | 'research' | 'prospects' | 'map' | 'opportunities' | 'activities')}
        className="mb-6"
      >
        <TabsList className="h-auto w-full justify-start rounded-lg border border-border bg-muted/30 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="prospects" className="gap-2">
            Prospects
            {account.prospectCount > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'px-1.5 py-0 text-[10px]',
                  activeTab === 'prospects' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                )}
              >
                {account.prospectCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <AccountOverviewTab
          accountId={account.id}
          accountName={account.companyName}
          overview={account.overview}
          notes={notes}
          documents={account.documents}
          keyPeople={account.keyPeople}
          onNotesChange={setNotes}
          onRefresh={loadAccount}
          onOpenProspects={() => setActiveTab('prospects')}
        />
      ) : activeTab === 'prospects' ? (
        <ProspectTab accountId={account.id} />
      ) : activeTab === 'map' ? (
        <>
          <ProspectMap
            accountId={account.id}
            onSelectProspect={(p) => { setMapSelectedProspect(p); fetchMapProspects(); }}
            onWriteEmail={(p) => setMapEmailingProspect(p)}
            onRefresh={fetchMapProspects}
          />
          {mapSelectedProspect && (
            <ProspectDetailModal
              prospect={mapSelectedProspect}
              accountId={account.id}
              allProspects={mapProspects}
              onClose={() => setMapSelectedProspect(null)}
              onSave={() => { setMapSelectedProspect(null); fetchMapProspects(); }}
              onWriteEmail={(p) => setMapEmailingProspect(p)}
              onViewExisting={(p) => setMapSelectedProspect(p)}
            />
          )}
          {mapEmailingProspect && (
            <ProspectEmailModal
              prospect={mapEmailingProspect}
              accountId={account.id}
              researchContext={perspective}
              onClose={() => setMapEmailingProspect(null)}
              onSave={() => {}}
            />
          )}
        </>
      ) : activeTab === 'opportunities' ? (
        <OpportunitiesSection accountId={account.id} />
      ) : activeTab === 'activities' ? (
        <ActivitiesSection accountId={account.id} />
      ) : (
      <>
      {/* Two-column layout: Sidebar + Main Content */}
      {account.status === 'completed' ? (
        <div className="flex gap-8">
          {/* Sidebar — hidden on mobile, sticky on desktop */}
          <ReportSidebar
            perspective={activePerspective}
            onPerspectiveChange={setActivePerspective}
            activeSectionId={activeSectionId}
            sections={sidebarSections}
            hasAuth0Research={hasAuth0Research}
            hasOktaResearch={hasOktaResearch}
            onPrint={() => window.print()}
            onDelete={() => setShowDeleteModal(true)}
            onReprocess={handleReprocess}
            isReprocessing={isReprocessing}
            showCategorization={showCategorization}
            onToggleCategorization={() => setShowCategorization(!showCategorization)}
          />

          {/* Mobile TOC button */}
          <Button
            size="icon"
            onClick={() => setShowMobileToc(!showMobileToc)}
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg lg:hidden"
            aria-label="Table of Contents"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          {/* Mobile TOC slide-over */}
          {showMobileToc && (
            <div className="lg:hidden fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileToc(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-72 overflow-y-auto border-l border-border bg-background p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold">Navigation</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowMobileToc(false)}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>

                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Research</h4>
                  <Tabs
                    value={activePerspective}
                    onValueChange={(value) => {
                      setActivePerspective(value as 'auth0' | 'okta');
                      setShowMobileToc(false);
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="auth0">Auth0</TabsTrigger>
                      <TabsTrigger value="okta">Okta</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</h4>
                  <div className="flex flex-col gap-1">
                    {sidebarSections.map((section) => (
                      <Button
                        key={section.id}
                        variant="ghost"
                        className="justify-start"
                        onClick={() => {
                          document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                          setShowMobileToc(false);
                        }}
                      >
                        {section.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tools</h4>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => { document.getElementById('section-email')?.scrollIntoView({ behavior: 'smooth' }); setShowMobileToc(false); }}
                    >
                      Email Writer
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => { document.getElementById('section-sequence')?.scrollIntoView({ behavior: 'smooth' }); setShowMobileToc(false); }}
                    >
                      Sequence Builder
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => { document.getElementById('section-pov')?.scrollIntoView({ behavior: 'smooth' }); setShowMobileToc(false); }}
                    >
                      POV Writer
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <Button variant="ghost" className="justify-start" onClick={() => { window.print(); setShowMobileToc(false); }}>
                    Print / PDF
                  </Button>
                  <Button variant="destructive" className="justify-start" onClick={() => { setShowDeleteModal(true); setShowMobileToc(false); }}>
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0" ref={mainContentRef}>
            {/* Collapsible SDR Categorization Section */}
            <div className="mb-8">
              <Button
                variant="outline"
                onClick={() => setShowCategorization(!showCategorization)}
                className="h-auto w-full justify-between rounded-xl border-border bg-card p-4 shadow-sm hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-lg font-bold">SDR Categorization</span>
                  {/* Unsaved changes indicator */}
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-100 text-xs font-semibold text-amber-700 animate-pulse">
                      Unsaved
                    </Badge>
                  )}
                  {/* Inline badges when collapsed */}
                  {!showCategorization && (
                    <div className="flex gap-2 ml-4">
                      {account.tier && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold',
                            account.tier === 'A' && 'border-emerald-300 bg-emerald-100 text-emerald-800',
                            account.tier === 'B' && 'border-blue-300 bg-blue-100 text-blue-800',
                            account.tier === 'C' && 'border-slate-300 bg-slate-100 text-slate-800'
                          )}
                        >
                          Auth0: Tier {account.tier}
                        </Badge>
                      )}
                      {account.oktaTier && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold',
                            account.oktaTier === 'A' && 'border-emerald-300 bg-emerald-100 text-emerald-800',
                            account.oktaTier === 'B' && 'border-blue-300 bg-blue-100 text-blue-800',
                            account.oktaTier === 'C' && 'border-slate-300 bg-slate-100 text-slate-800'
                          )}
                        >
                          Okta: Tier {account.oktaTier}
                        </Badge>
                      )}
                      {account.oktaPatch && (
                        <Badge variant="outline" className="border-violet-300 bg-violet-100 text-xs font-semibold text-violet-800">
                          {account.oktaPatch === 'emerging' ? 'Emerging' : account.oktaPatch === 'crp' ? 'Corporate' : account.oktaPatch === 'ent' ? 'Enterprise' : account.oktaPatch === 'pubsec' ? 'Public Sector' : 'Strategic'}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showCategorization ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>

              {showCategorization && (
                <div className="bg-white rounded-b-xl shadow-lg px-6 pb-6 border border-t-0 border-gray-200">
                  {/* Two-column layout for Auth0 and Okta */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4">
                    {/* Auth0 CIAM Categorization */}
                    <div className="border-2 border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Auth0 CIAM
                        </h3>
                        {!isEditingAuth0 && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleAuth0AISuggest}
                              className="h-7 bg-gradient-to-r from-blue-600 to-purple-600 px-3 text-xs font-semibold text-white hover:from-blue-700 hover:to-purple-700"
                              title="AI Suggest"
                            >
                              AI
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleEditAuth0}
                              className="h-7 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>

                      {!isEditingAuth0 ? (
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            {account.tier && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-sm font-semibold',
                                  account.tier === 'A' && 'border-green-300 bg-green-100 text-green-800',
                                  account.tier === 'B' && 'border-blue-300 bg-blue-100 text-blue-800',
                                  account.tier === 'C' && 'border-gray-300 bg-gray-100 text-gray-800'
                                )}
                              >
                                Tier {account.tier}
                              </Badge>
                            )}
                            {account.priorityScore !== null && (
                              <Badge variant="outline" className="border-purple-300 bg-purple-100 text-sm font-semibold text-purple-800">
                                Priority: {account.priorityScore}/10
                              </Badge>
                            )}
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Revenue</Label>
                            <p className="text-sm">{account.estimatedAnnualRevenue || 'Not set'}</p>
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">User Volume</Label>
                            <p className="text-sm">{account.estimatedUserVolume || 'Not set'}</p>
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">SKUs</Label>
                            <div className="flex flex-wrap gap-2">
                              {account.auth0Skus && account.auth0Skus.length > 0 ? (
                                account.auth0Skus.map(sku => (
                                  <Badge key={sku} variant="outline" className="border-blue-300 bg-blue-100 text-xs font-medium text-blue-800">
                                    {sku}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No SKUs set</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">Use Cases</Label>
                            <div className="flex flex-wrap gap-1">
                              {account.useCases && account.useCases.length > 0 ? (
                                account.useCases.map(uc => (
                                  <Badge key={uc} variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700">
                                    {uc}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No use cases</span>
                              )}
                            </div>
                          </div>
                          {account.sdrNotes && (
                            <div>
                              <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</Label>
                              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{account.sdrNotes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <TierSelector
                            value={auth0EditData.tier}
                            onChange={(tier) => setAuth0EditData({ ...auth0EditData, tier })}
                          />
                          <PrioritySlider
                            value={auth0EditData.priorityScore}
                            onChange={(priorityScore) => setAuth0EditData({ ...auth0EditData, priorityScore })}
                          />
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Revenue</Label>
                            <Input
                              value={auth0EditData.estimatedAnnualRevenue}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, estimatedAnnualRevenue: e.target.value })}
                              placeholder="e.g., $10M-$50M"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">User Volume</Label>
                            <Input
                              value={auth0EditData.estimatedUserVolume}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, estimatedUserVolume: e.target.value })}
                              placeholder="e.g., 100K-500K"
                            />
                          </div>
                          <SKUMultiSelect
                            value={auth0EditData.auth0Skus}
                            onChange={(auth0Skus) => setAuth0EditData({ ...auth0EditData, auth0Skus })}
                          />
                          <UseCaseMultiSelect
                            value={auth0EditData.useCases}
                            onChange={(useCases) => setAuth0EditData({ ...auth0EditData, useCases })}
                          />
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</Label>
                            <Textarea
                              value={auth0EditData.sdrNotes}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, sdrNotes: e.target.value })}
                              placeholder="Add notes..."
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={handleSaveAuth0}
                              disabled={savingAuth0}
                              className="flex-1 bg-green-600 text-sm font-semibold text-white hover:bg-green-700"
                            >
                              {savingAuth0 ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={handleCancelAuth0}
                              disabled={savingAuth0}
                              className="flex-1 text-sm font-semibold"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Okta Workforce Categorization */}
                    <div className="border-2 border-purple-200 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-purple-900 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Okta Workforce
                        </h3>
                        {!isEditingOkta && account.oktaProcessedAt && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleOktaAISuggest}
                              className="h-7 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 text-xs font-semibold text-white hover:from-purple-700 hover:to-indigo-700"
                              title="AI Suggest"
                            >
                              AI
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleEditOkta}
                              className="h-7 bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-700"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>

                      {!isEditingOkta ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {account.oktaTier && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-sm font-semibold',
                                  account.oktaTier === 'A' && 'border-green-300 bg-green-100 text-green-800',
                                  account.oktaTier === 'B' && 'border-blue-300 bg-blue-100 text-blue-800',
                                  account.oktaTier === 'C' && 'border-gray-300 bg-gray-100 text-gray-800'
                                )}
                              >
                                Tier {account.oktaTier}
                              </Badge>
                            )}
                            {account.oktaPatch && (
                              <Badge variant="outline" className="border-purple-300 bg-purple-100 text-sm font-semibold text-purple-800">
                                {account.oktaPatch === 'emerging' ? 'Emerging' : account.oktaPatch === 'crp' ? 'Corporate' : account.oktaPatch === 'ent' ? 'Enterprise' : account.oktaPatch === 'pubsec' ? 'Public Sector' : 'Strategic'}
                              </Badge>
                            )}
                            {account.oktaPriorityScore !== null && (
                              <Badge variant="outline" className="border-purple-300 bg-purple-100 text-sm font-semibold text-purple-800">
                                Priority: {account.oktaPriorityScore}/10
                              </Badge>
                            )}
                            {account.oktaOpportunityType && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-bold',
                                  account.oktaOpportunityType === 'net_new' && 'border-green-300 bg-green-100 text-green-800',
                                  account.oktaOpportunityType === 'competitive_displacement' && 'border-orange-300 bg-orange-100 text-orange-800',
                                  account.oktaOpportunityType === 'expansion' && 'border-blue-300 bg-blue-100 text-blue-800',
                                  account.oktaOpportunityType === 'unknown' && 'border-gray-300 bg-gray-100 text-gray-800'
                                )}
                              >
                                {account.oktaOpportunityType === 'net_new' ? 'Net New' :
                                 account.oktaOpportunityType === 'competitive_displacement' ? 'Competitive' :
                                 account.oktaOpportunityType === 'expansion' ? 'Expansion' : 'Unknown'}
                              </Badge>
                            )}
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Revenue</Label>
                            <p className="text-sm">{account.oktaEstimatedAnnualRevenue || 'Not set'}</p>
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Employee Count</Label>
                            <p className="text-sm">{account.oktaEstimatedUserVolume || 'Not set'}</p>
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">SKUs</Label>
                            <div className="flex flex-wrap gap-2">
                              {account.oktaSkus && account.oktaSkus.length > 0 ? (
                                account.oktaSkus.map(sku => (
                                  <Badge key={sku} variant="outline" className="border-purple-300 bg-purple-100 text-xs font-medium text-purple-800">
                                    {sku}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No SKUs set</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">Use Cases</Label>
                            <div className="flex flex-wrap gap-1">
                              {account.oktaUseCases && account.oktaUseCases.length > 0 ? (
                                account.oktaUseCases.map(uc => (
                                  <Badge key={uc} variant="outline" className="border-purple-200 bg-purple-50 text-xs text-purple-700">
                                    {uc}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No use cases</span>
                              )}
                            </div>
                          </div>
                          {account.oktaSdrNotes && (
                            <div>
                              <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</Label>
                              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{account.oktaSdrNotes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <TierSelector
                            value={oktaEditData.oktaTier}
                            onChange={(tier) => setOktaEditData({ ...oktaEditData, oktaTier: tier })}
                          />
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Revenue</Label>
                            <Input
                              value={oktaEditData.oktaEstimatedAnnualRevenue}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaEstimatedAnnualRevenue: e.target.value })}
                              placeholder="e.g., $10M-$50M"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Employee Count</Label>
                            <Input
                              value={oktaEditData.oktaEstimatedUserVolume}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaEstimatedUserVolume: e.target.value })}
                              placeholder="e.g., 500-1000"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Okta SKUs (comma-separated)</Label>
                            <Textarea
                              value={oktaEditData.oktaSkus.join(', ')}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaSkus: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                              placeholder="Workforce Identity Cloud, Identity Governance..."
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Use Cases (comma-separated)</Label>
                            <Textarea
                              value={oktaEditData.oktaUseCases.join(', ')}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaUseCases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="SSO, MFA, Identity Governance..."
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</Label>
                            <Textarea
                              value={oktaEditData.oktaSdrNotes}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaSdrNotes: e.target.value })}
                              placeholder="Add notes..."
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={handleSaveOkta}
                              disabled={savingOkta}
                              className="flex-1 bg-green-600 text-sm font-semibold text-white hover:bg-green-700"
                            >
                              {savingOkta ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={handleCancelOkta}
                              disabled={savingOkta}
                              className="flex-1 text-sm font-semibold"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Suggestion Panels */}
                  {showAuth0AISuggestions && (
                    <div className="mt-6">
                      <AIAutoCategorizePanel
                        accountId={account.id}
                        onAccept={handleAcceptAuth0AISuggestions}
                        onClose={() => setShowAuth0AISuggestions(false)}
                      />
                    </div>
                  )}
                  {showOktaAISuggestions && account.oktaProcessedAt && (
                    <div className="mt-6 border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-purple-900">Okta AI Suggestions</h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowOktaAISuggestions(false)}
                        >
                          &times;
                        </Button>
                      </div>
                      <p className="text-sm text-purple-700 mb-4">
                        This will call the Okta AI categorizer. Click &quot;Generate Suggestions&quot; below.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/accounts/${id}/okta-auto-categorize`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ patch: oktaPatch }),
                            });
                            if (!res.ok) throw new Error('Failed to generate Okta suggestions');
                            const data = await res.json();
                            handleAcceptOktaAISuggestions(data.suggestions);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to generate suggestions');
                          }
                        }}
                        className="bg-purple-600 font-semibold text-white hover:bg-purple-700"
                      >
                        Generate Suggestions
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Triage Summary (if triaged) */}
            {account.triagedAt && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6 mb-8 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-purple-900">Triage Assessment</h3>
                  <div className="flex gap-2 ml-auto">
                    {account.triageAuth0Tier && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        account.triageAuth0Tier === 'A' ? 'bg-green-100 text-green-800' :
                        account.triageAuth0Tier === 'B' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        Auth0: Tier {account.triageAuth0Tier}
                      </span>
                    )}
                    {account.triageOktaTier && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        account.triageOktaTier === 'A' ? 'bg-green-100 text-green-800' :
                        account.triageOktaTier === 'B' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        Okta: Tier {account.triageOktaTier}
                      </span>
                    )}
                  </div>
                </div>
                {account.triageSummary && (
                  <p className="text-gray-700 mb-3">{account.triageSummary}</p>
                )}
                {account.triageData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {account.triageData.estimated_arr && account.triageData.estimated_arr !== 'Unknown' && (
                      <div>
                        <span className="font-medium text-gray-600">Est. Revenue:</span>{' '}
                        <span className="text-gray-800">{account.triageData.estimated_arr}</span>
                      </div>
                    )}
                    {account.triageData.estimated_employees && account.triageData.estimated_employees !== 'Unknown' && (
                      <div>
                        <span className="font-medium text-gray-600">Est. Employees:</span>{' '}
                        <span className="text-gray-800">{account.triageData.estimated_employees}</span>
                      </div>
                    )}
                    {account.triageData.key_signals && account.triageData.key_signals.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-gray-600">Key Signals:</span>{' '}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {account.triageData.key_signals.map((signal: string, i: number) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-800 border border-yellow-200">
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {account.triageData.auth0_tier_reasoning && (
                      <div>
                        <span className="font-medium text-gray-600">Auth0 Reasoning:</span>{' '}
                        <span className="text-gray-700">{account.triageData.auth0_tier_reasoning}</span>
                      </div>
                    )}
                    {account.triageData.okta_tier_reasoning && (
                      <div>
                        <span className="font-medium text-gray-600">Okta Reasoning:</span>{' '}
                        <span className="text-gray-700">{account.triageData.okta_tier_reasoning}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Research Sections — Auth0 Perspective */}
            {activePerspective === 'auth0' && (
              <>
                {/* Command of the Message */}
                {account.commandOfMessage && (
                  <div id="section-command" className="scroll-mt-24 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-8 mb-8 shadow-md">
                    <MarkdownSection
                      title="Command of the Message: Auth0 Value Framework"
                      content={account.commandOfMessage}
                      icon={<MessageIcon />}
                      sectionKey="command_of_message"
                      perspective="auth0"
                      allSectionKeys={auth0SectionKeys}
                      onRerun={handleSectionRerun}
                      isRerunning={runningSections.has('command_of_message')}
                      comment={sectionComments['auth0:command_of_message']}
                      onCommentSave={(content) => handleCommentSave('auth0', 'command_of_message', content)}
                      onCommentDelete={() => handleCommentDelete('auth0', 'command_of_message')}
                    />
                  </div>
                )}

                {/* Executive Summary */}
                {account.researchSummary && (
                  <div id="section-summary" className="scroll-mt-24 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 mb-8 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-600 rounded-lg text-white">
                        <TargetIcon />
                      </div>
                      <h2 className="text-3xl font-bold text-blue-900">
                        Executive Summary
                      </h2>
                    </div>
                    <MarkdownSection
                      title=""
                      content={account.researchSummary}
                    />
                  </div>
                )}

                {/* Individual research sections — each a standalone card */}
                <div id="section-auth" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Current Authentication Solution"
                    content={account.currentAuthSolution}
                    icon={<LockIcon />}
                    sectionKey="current_auth_solution"
                    perspective="auth0"
                    allSectionKeys={auth0SectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('current_auth_solution')}
                    comment={sectionComments['auth0:current_auth_solution']}
                    onCommentSave={(content) => handleCommentSave('auth0', 'current_auth_solution', content)}
                    onCommentDelete={() => handleCommentDelete('auth0', 'current_auth_solution')}
                  />
                </div>

                <div id="section-users" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Customer Base & Scale"
                    content={account.customerBaseInfo}
                    icon={<UsersIcon />}
                    sectionKey="customer_base_info"
                    perspective="auth0"
                    allSectionKeys={auth0SectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('customer_base_info')}
                    comment={sectionComments['auth0:customer_base_info']}
                    onCommentSave={(content) => handleCommentSave('auth0', 'customer_base_info', content)}
                    onCommentDelete={() => handleCommentDelete('auth0', 'customer_base_info')}
                  />
                </div>

                <div id="section-security" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Security & Compliance"
                    content={account.securityIncidents}
                    icon={<ShieldIcon />}
                    sectionKey="security_incidents"
                    perspective="auth0"
                    allSectionKeys={auth0SectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('security_incidents')}
                    comment={sectionComments['auth0:security_incidents']}
                    onCommentSave={(content) => handleCommentSave('auth0', 'security_incidents', content)}
                    onCommentDelete={() => handleCommentDelete('auth0', 'security_incidents')}
                  />
                </div>

                <div id="section-news" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Recent News & Funding"
                    content={account.newsAndFunding}
                    icon={<NewspaperIcon />}
                    sectionKey="news_and_funding"
                    perspective="auth0"
                    allSectionKeys={auth0SectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('news_and_funding')}
                    comment={sectionComments['auth0:news_and_funding']}
                    onCommentSave={(content) => handleCommentSave('auth0', 'news_and_funding', content)}
                    onCommentDelete={() => handleCommentDelete('auth0', 'news_and_funding')}
                  />
                </div>

                <div id="section-tech" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Tech Transformation Initiatives"
                    content={account.techTransformation}
                    icon={<LightningIcon />}
                    sectionKey="tech_transformation"
                    perspective="auth0"
                    allSectionKeys={auth0SectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('tech_transformation')}
                    comment={sectionComments['auth0:tech_transformation']}
                    onCommentSave={(content) => handleCommentSave('auth0', 'tech_transformation', content)}
                    onCommentDelete={() => handleCommentDelete('auth0', 'tech_transformation')}
                  />
                </div>

                {/* Prospects */}
                {account.prospects && account.prospects.length > 0 && (
                  <div id="section-prospects" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h2 className="text-3xl font-bold text-gray-900">Key Prospects & Personas</h2>
                    </div>
                    <p className="text-gray-600 mb-6">
                      Target decision-makers and ideal customer personas for Auth0 CIAM outreach
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {account.prospects.map((prospect, idx) => {
                        const isPersona = prospect.name.startsWith('Persona:');
                        return (
                          <div
                            key={idx}
                            className={`border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${
                              isPersona
                                ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white'
                                : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'
                            }`}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${isPersona ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                {isPersona ? (
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-lg text-gray-900 mb-1">
                                  {prospect.name}
                                </h4>
                                <p className={`text-sm font-medium px-2 py-1 rounded inline-block ${
                                  isPersona ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {prospect.title}
                                </p>
                              </div>
                            </div>
                            {prospect.background && (
                              <p className="text-sm text-gray-700 leading-relaxed mt-3 pl-11">
                                {prospect.background}
                              </p>
                            )}
                            {isPersona && (
                              <div className="mt-3 pl-11">
                                <span className="text-xs text-purple-600 font-medium">Ideal Persona</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Research Sections — Okta Perspective */}
            {activePerspective === 'okta' && (
              <>
                {/* Executive Summary */}
                {account.oktaResearchSummary && (
                  <div id="section-summary" className="scroll-mt-24 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-8 mb-8 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-purple-600 rounded-lg text-white">
                        <TargetIcon />
                      </div>
                      <h2 className="text-3xl font-bold text-purple-900">
                        Executive Summary (Okta Perspective)
                      </h2>
                    </div>
                    <MarkdownSection
                      title=""
                      content={account.oktaResearchSummary}
                    />
                    {account.oktaOpportunityType && (
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <div className="flex gap-4 items-center">
                          <span className="text-sm font-semibold text-purple-700">Opportunity Type:</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            account.oktaOpportunityType === 'net_new' ? 'bg-green-100 text-green-800' :
                            account.oktaOpportunityType === 'competitive_displacement' ? 'bg-orange-100 text-orange-800' :
                            account.oktaOpportunityType === 'expansion' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {account.oktaOpportunityType === 'net_new' ? 'Net New' :
                             account.oktaOpportunityType === 'competitive_displacement' ? 'Competitive Displacement' :
                             account.oktaOpportunityType === 'expansion' ? 'Expansion' : 'Unknown'}
                          </span>
                          {account.oktaPriorityScore !== null && (
                            <>
                              <span className="text-sm font-semibold text-purple-700 ml-4">Priority Score:</span>
                              <span className="text-lg font-bold text-purple-900">{account.oktaPriorityScore}/10</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Individual research sections — each a standalone card */}
                <div id="section-auth" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Current IAM Solution"
                    content={account.oktaCurrentIamSolution}
                    icon={<LockIcon />}
                    sectionKey="okta_current_iam_solution"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_current_iam_solution')}
                    comment={sectionComments['okta:okta_current_iam_solution']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_current_iam_solution', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_current_iam_solution')}
                  />
                </div>

                <div id="section-users" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Workforce & IT Complexity"
                    content={account.oktaWorkforceInfo}
                    icon={<UsersIcon />}
                    sectionKey="okta_workforce_info"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_workforce_info')}
                    comment={sectionComments['okta:okta_workforce_info']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_workforce_info', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_workforce_info')}
                  />
                </div>

                <div id="section-security" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Security & Compliance"
                    content={account.oktaSecurityIncidents}
                    icon={<ShieldIcon />}
                    sectionKey="okta_security_incidents"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_security_incidents')}
                    comment={sectionComments['okta:okta_security_incidents']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_security_incidents', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_security_incidents')}
                  />
                </div>

                <div id="section-news" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Recent News & Funding"
                    content={account.oktaNewsAndFunding}
                    icon={<NewspaperIcon />}
                    sectionKey="okta_news_and_funding"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_news_and_funding')}
                    comment={sectionComments['okta:okta_news_and_funding']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_news_and_funding', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_news_and_funding')}
                  />
                </div>

                <div id="section-tech" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Tech Transformation Initiatives"
                    content={account.oktaTechTransformation}
                    icon={<LightningIcon />}
                    sectionKey="okta_tech_transformation"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_tech_transformation')}
                    comment={sectionComments['okta:okta_tech_transformation']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_tech_transformation', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_tech_transformation')}
                  />
                </div>

                <div id="section-ecosystem" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Okta Ecosystem & Relationship"
                    content={account.oktaEcosystem}
                    icon={<TargetIcon />}
                    sectionKey="okta_ecosystem"
                    perspective="okta"
                    allSectionKeys={oktaSectionKeys}
                    onRerun={handleSectionRerun}
                    isRerunning={runningSections.has('okta_ecosystem')}
                    comment={sectionComments['okta:okta_ecosystem']}
                    onCommentSave={(content) => handleCommentSave('okta', 'okta_ecosystem', content)}
                    onCommentDelete={() => handleCommentDelete('okta', 'okta_ecosystem')}
                  />
                </div>

                {/* Okta Prospects */}
                {account.oktaProspects && account.oktaProspects.length > 0 && (
                  <div id="section-prospects" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h2 className="text-3xl font-bold text-gray-900">Key Prospects & Personas</h2>
                    </div>
                    <p className="text-gray-600 mb-6">
                      Target decision-makers and ideal customer personas for Okta Workforce Identity outreach
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {account.oktaProspects.map((prospect, idx) => {
                        const isPersona = prospect.isPersona || prospect.name.startsWith('Persona:');
                        return (
                          <div
                            key={idx}
                            className={`border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${
                              isPersona
                                ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white'
                                : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'
                            }`}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${isPersona ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                {isPersona ? (
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-lg text-gray-900 mb-1">
                                  {prospect.name}
                                </h4>
                                <p className={`text-sm font-medium px-2 py-1 rounded inline-block ${
                                  isPersona ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {prospect.title}
                                </p>
                                {prospect.location && (
                                  <span className="ml-2 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                    {prospect.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            {prospect.background && (
                              <p className="text-sm text-gray-700 leading-relaxed mt-3 pl-11">
                                {prospect.background}
                              </p>
                            )}
                            {isPersona && (
                              <div className="mt-3 pl-11">
                                <span className="text-xs text-purple-600 font-medium">Ideal Persona</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Account Notes */}
            <div id="section-notes" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <h2 className="text-3xl font-bold text-gray-900">Account Notes</h2>
              </div>
              <p className="text-gray-600 mb-6">
                Track engagement history, meeting notes, and observations about this account.
              </p>
              <AccountNotes
                accountId={account.id}
                notes={notes}
                onNotesChange={setNotes}
              />
            </div>

            {/* Email Writer — always rendered inline */}
            <div id="section-email" className="scroll-mt-24 mb-8">
              <EmailWriter accountId={account.id} account={account} />
            </div>

            {/* Sequence Builder — always rendered inline */}
            <div id="section-sequence" className="scroll-mt-24 mb-8">
              <SequenceWriter accountId={account.id} account={account} />
            </div>

            {/* POV Writer — always rendered inline */}
            <div id="section-pov" className="scroll-mt-24 mb-8">
              <PovWriter accountId={account.id} account={account} />
            </div>
          </div>
        </div>
      ) : (
        /* Non-completed accounts: show triage data if available + action buttons */
        <div>
          {/* Triage Assessment (for triaged-but-not-yet-researched accounts) */}
          {account.triagedAt && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-600 rounded-lg text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-purple-900">Triage Assessment</h3>
                <div className="flex gap-2 ml-auto">
                  {account.triageAuth0Tier && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      account.triageAuth0Tier === 'A' ? 'bg-green-100 text-green-800' :
                      account.triageAuth0Tier === 'B' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      Auth0: Tier {account.triageAuth0Tier}
                    </span>
                  )}
                  {account.triageOktaTier && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      account.triageOktaTier === 'A' ? 'bg-green-100 text-green-800' :
                      account.triageOktaTier === 'B' ? 'bg-blue-100 text-blue-800' :
                      account.triageOktaTier === 'DQ' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      Okta: {account.triageOktaTier === 'DQ' ? 'DQ' : `Tier ${account.triageOktaTier}`}
                    </span>
                  )}
                </div>
              </div>
              {account.triageSummary && (
                <p className="text-gray-700 mb-3">{account.triageSummary}</p>
              )}
              {account.triageData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {account.triageData.estimated_arr && account.triageData.estimated_arr !== 'Unknown' && (
                    <div>
                      <span className="font-medium text-gray-600">Est. Revenue:</span>{' '}
                      <span className="text-gray-800">{account.triageData.estimated_arr}</span>
                    </div>
                  )}
                  {account.triageData.estimated_employees && account.triageData.estimated_employees !== 'Unknown' && (
                    <div>
                      <span className="font-medium text-gray-600">Est. Employees:</span>{' '}
                      <span className="text-gray-800">{account.triageData.estimated_employees}</span>
                    </div>
                  )}
                  {account.triageData.key_signals && account.triageData.key_signals.length > 0 && (
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-600">Key Signals:</span>{' '}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {account.triageData.key_signals.map((signal: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-800 border border-yellow-200">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {account.triageData.auth0_tier_reasoning && (
                    <div>
                      <span className="font-medium text-gray-600">Auth0 Reasoning:</span>{' '}
                      <span className="text-gray-700">{account.triageData.auth0_tier_reasoning}</span>
                    </div>
                  )}
                  {account.triageData.okta_tier_reasoning && (
                    <div>
                      <span className="font-medium text-gray-600">Okta Reasoning:</span>{' '}
                      <span className="text-gray-700">{account.triageData.okta_tier_reasoning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Process button */}
              <div className="mt-4 pt-4 border-t border-purple-200">
                <p className="text-sm text-purple-700 mb-3">This account has been triaged but not yet fully researched.</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleReprocess('both')}
                    disabled={isReprocessing}
                    className="text-sm"
                  >
                    {isReprocessing ? 'Starting...' : 'Research (Both)'}
                  </Button>
                  <Button
                    onClick={() => handleReprocess('auth0')}
                    disabled={isReprocessing}
                    className="bg-blue-600 text-sm text-white hover:bg-blue-700"
                  >
                    Auth0 Only
                  </Button>
                  <Button
                    onClick={() => handleReprocess('okta')}
                    disabled={isReprocessing}
                    className="bg-indigo-600 text-sm text-white hover:bg-indigo-700"
                  >
                    Okta Only
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!account.triagedAt && (
            <Card className="mb-6 bg-muted/30">
              <CardContent className="p-8 text-center">
                <p className="mb-4 text-muted-foreground">This account has not been researched yet.</p>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={() => handleReprocess('both')}
                    disabled={isReprocessing}
                    className="text-sm"
                  >
                    {isReprocessing ? 'Starting...' : 'Start Research'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button
              variant="secondary"
              onClick={() => guardedNavigate(backToListUrl)}
            >
              Back to Accounts
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
              className="gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </Button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        accountName={account.companyName}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelNavigation} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Unsaved Changes</h3>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              You have unsaved edits in the {isEditingAuth0 ? 'Auth0' : 'Okta'} categorization panel. Navigating away will discard these changes.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelNavigation}
                className="flex-1"
              >
                Keep Editing
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDiscard}
                className="flex-1"
              >
                Discard & Leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
