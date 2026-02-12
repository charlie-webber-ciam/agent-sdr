'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import MarkdownSection from '@/components/MarkdownSection';
import TierSelector from '@/components/TierSelector';
import PrioritySlider from '@/components/PrioritySlider';
import UseCaseMultiSelect from '@/components/UseCaseMultiSelect';
import SKUMultiSelect from '@/components/SKUMultiSelect';
import AIAutoCategorizePanel from '@/components/AIAutoCategorizePanel';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import EmailWriter from '@/components/EmailWriter';
import SequenceWriter from '@/components/SequenceWriter';
import ReportSidebar, { SidebarSection } from '@/components/ReportSidebar';
import { usePerspective } from '@/lib/perspective-context';

// Utility to format domain display
const formatDomain = (domain: string | null) => {
  if (!domain || domain.includes('.placeholder')) {
    return 'No domain';
  }
  return domain;
};

interface AccountDetail {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  status: string;
  // Auth0 CIAM Research
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
  // Okta SDR fields
  oktaTier: 'A' | 'B' | 'C' | null;
  oktaEstimatedAnnualRevenue: string | null;
  oktaEstimatedUserVolume: string | null;
  oktaUseCases: string[];
  oktaSkus: string[];
  oktaSdrNotes: string | null;
  oktaLastEditedAt: string | null;
  oktaAiSuggestions: any | null;
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

const SmallProspectsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { perspective } = usePerspective();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Perspective state for research view (local to this page, initialized from global)
  const [activePerspective, setActivePerspective] = useState<'auth0' | 'okta'>(perspective === 'okta' ? 'okta' : 'auth0');

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

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await fetch(`/api/accounts/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch account');
        }
        const data = await res.json();
        setAccount(data);

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
    };

    fetchAccount();
  }, [id]);

  // Scroll-spy with IntersectionObserver
  useEffect(() => {
    const sectionIds = [
      'section-summary', 'section-auth', 'section-users', 'section-security',
      'section-news', 'section-tech', 'section-ecosystem', 'section-prospects',
      'section-email', 'section-sequence',
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

      // Refresh account data
      const updatedRes = await fetch(`/api/accounts/${id}`);
      const updatedData = await updatedRes.json();
      setAccount(updatedData);
      setIsEditingAuth0(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save Auth0 changes');
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

      // Refresh account data
      const updatedRes = await fetch(`/api/accounts/${id}`);
      const updatedData = await updatedRes.json();
      setAccount(updatedData);
      setIsEditingOkta(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save Okta changes');
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

      // Redirect to accounts list after successful deletion
      router.push('/accounts?deleted=true');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
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
      alert(err instanceof Error ? err.message : 'Failed to retry account');
      setIsRetrying(false);
    }
  };

  const handleReprocess = async (researchType: 'both' | 'auth0' | 'okta') => {
    setIsReprocessing(true);
    try {
      const res = await fetch(`/api/accounts/${id}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ researchType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reprocess account');
      }

      const data = await res.json();
      // Redirect to processing page
      router.push(data.redirectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reprocess account');
      setIsReprocessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Account not found'}</p>
          <button
            onClick={() => router.push('/accounts')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Accounts
          </button>
        </div>
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
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header — full width above the two columns */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/accounts')}
          className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium transition-colors"
        >
          &larr; Back to Accounts
        </button>

        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-8 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 text-gray-900">{account.companyName}</h1>
              <div className="flex items-center gap-3 text-lg text-gray-600 mb-3">
                <span className="font-medium">{formatDomain(account.domain)}</span>
                <span>&bull;</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">{account.industry}</span>
                {account.auth0AccountOwner && (
                  <>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {account.auth0AccountOwner}
                    </span>
                  </>
                )}
              </div>

              {/* Tier, SKU, Priority Badges + Research Status Indicators */}
              <div className="flex flex-wrap gap-2 items-center">
                {account.tier && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${
                    account.tier === 'A' ? 'bg-green-100 text-green-800 border-green-300' :
                    account.tier === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    'bg-gray-100 text-gray-800 border-gray-300'
                  }`}>
                    Tier {account.tier}
                  </span>
                )}
                {account.auth0Skus && account.auth0Skus.map(sku => (
                  <span key={sku} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold border-2 border-purple-300">
                    {sku}
                  </span>
                ))}
                {account.priorityScore !== null && account.priorityScore >= 7 && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold border-2 border-red-300">
                    Priority {account.priorityScore}/10
                  </span>
                )}
                {/* Research status badges */}
                {account.status === 'completed' && (
                  <>
                    <span className="ml-2 text-gray-300">|</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      hasAuth0Research ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      Auth0 {hasAuth0Research ? 'Done' : 'N/A'}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      hasOktaResearch ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      Okta {hasOktaResearch ? 'Done' : 'N/A'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                account.status === 'completed'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : account.status === 'failed'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </span>
          </div>

          <p className="text-sm text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Processed: {formatDate(account.processedAt)}
          </p>

          {account.errorMessage && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
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
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isRetrying ? 'Retrying...' : 'Retry Research'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
          <button
            onClick={() => setShowMobileToc(!showMobileToc)}
            className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            aria-label="Table of Contents"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile TOC slide-over */}
          {showMobileToc && (
            <div className="lg:hidden fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileToc(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Navigation</h3>
                  <button onClick={() => setShowMobileToc(false)} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Research toggle */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Research</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setActivePerspective('auth0'); setShowMobileToc(false); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                        activePerspective === 'auth0' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Auth0
                    </button>
                    <button
                      onClick={() => { setActivePerspective('okta'); setShowMobileToc(false); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                        activePerspective === 'okta' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Okta
                    </button>
                  </div>
                </div>
                {/* Section links */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sections</h4>
                  {sidebarSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                        setShowMobileToc(false);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
                {/* Tool links */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tools</h4>
                  <button
                    onClick={() => { document.getElementById('section-email')?.scrollIntoView({ behavior: 'smooth' }); setShowMobileToc(false); }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
                  >
                    Email Writer
                  </button>
                  <button
                    onClick={() => { document.getElementById('section-sequence')?.scrollIntoView({ behavior: 'smooth' }); setShowMobileToc(false); }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
                  >
                    Sequence Builder
                  </button>
                </div>
                {/* Actions */}
                <div className="border-t pt-4 flex flex-col gap-2">
                  <button onClick={() => { window.print(); setShowMobileToc(false); }} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded text-left">
                    Print / PDF
                  </button>
                  <button onClick={() => { setShowDeleteModal(true); setShowMobileToc(false); }} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0" ref={mainContentRef}>
            {/* Collapsible SDR Categorization Section */}
            <div className="mb-8">
              <button
                onClick={() => setShowCategorization(!showCategorization)}
                className="w-full flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-lg font-bold text-gray-900">SDR Categorization</span>
                  {/* Inline badges when collapsed */}
                  {!showCategorization && (
                    <div className="flex gap-2 ml-4">
                      {account.tier && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          account.tier === 'A' ? 'bg-green-100 text-green-800' :
                          account.tier === 'B' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          Auth0: Tier {account.tier}
                        </span>
                      )}
                      {account.oktaTier && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          account.oktaTier === 'A' ? 'bg-green-100 text-green-800' :
                          account.oktaTier === 'B' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          Okta: Tier {account.oktaTier}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showCategorization ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

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
                            <button
                              onClick={handleAuth0AISuggest}
                              className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded text-xs font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                              title="AI Suggest"
                            >
                              AI
                            </button>
                            <button
                              onClick={handleEditAuth0}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditingAuth0 ? (
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            {account.tier && (
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${
                                account.tier === 'A' ? 'bg-green-100 text-green-800 border-green-300' :
                                account.tier === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                'bg-gray-100 text-gray-800 border-gray-300'
                              }`}>
                                Tier {account.tier}
                              </span>
                            )}
                            {account.priorityScore !== null && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold border-2 border-purple-300">
                                Priority: {account.priorityScore}/10
                              </span>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Revenue</label>
                            <p className="text-sm text-gray-900">{account.estimatedAnnualRevenue || 'Not set'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">User Volume</label>
                            <p className="text-sm text-gray-900">{account.estimatedUserVolume || 'Not set'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">SKUs</label>
                            <div className="flex flex-wrap gap-2">
                              {account.auth0Skus && account.auth0Skus.length > 0 ? (
                                account.auth0Skus.map(sku => (
                                  <span key={sku} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                    {sku}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No SKUs set</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">Use Cases</label>
                            <div className="flex flex-wrap gap-1">
                              {account.useCases && account.useCases.length > 0 ? (
                                account.useCases.map(uc => (
                                  <span key={uc} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                    {uc}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No use cases</span>
                              )}
                            </div>
                          </div>
                          {account.sdrNotes && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">{account.sdrNotes}</p>
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
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Revenue</label>
                            <input
                              type="text"
                              value={auth0EditData.estimatedAnnualRevenue}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, estimatedAnnualRevenue: e.target.value })}
                              placeholder="e.g., $10M-$50M"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">User Volume</label>
                            <input
                              type="text"
                              value={auth0EditData.estimatedUserVolume}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, estimatedUserVolume: e.target.value })}
                              placeholder="e.g., 100K-500K"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                            <textarea
                              value={auth0EditData.sdrNotes}
                              onChange={(e) => setAuth0EditData({ ...auth0EditData, sdrNotes: e.target.value })}
                              placeholder="Add notes..."
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleSaveAuth0}
                              disabled={savingAuth0}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 text-sm"
                            >
                              {savingAuth0 ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelAuth0}
                              disabled={savingAuth0}
                              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm"
                            >
                              Cancel
                            </button>
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
                            <button
                              onClick={handleOktaAISuggest}
                              className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded text-xs font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
                              title="AI Suggest"
                            >
                              AI
                            </button>
                            <button
                              onClick={handleEditOkta}
                              className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditingOkta ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {account.oktaTier && (
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${
                                account.oktaTier === 'A' ? 'bg-green-100 text-green-800 border-green-300' :
                                account.oktaTier === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                'bg-gray-100 text-gray-800 border-gray-300'
                              }`}>
                                Tier {account.oktaTier}
                              </span>
                            )}
                            {account.oktaPriorityScore !== null && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold border-2 border-purple-300">
                                Priority: {account.oktaPriorityScore}/10
                              </span>
                            )}
                            {account.oktaOpportunityType && (
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                account.oktaOpportunityType === 'net_new' ? 'bg-green-100 text-green-800' :
                                account.oktaOpportunityType === 'competitive_displacement' ? 'bg-orange-100 text-orange-800' :
                                account.oktaOpportunityType === 'expansion' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {account.oktaOpportunityType === 'net_new' ? 'Net New' :
                                 account.oktaOpportunityType === 'competitive_displacement' ? 'Competitive' :
                                 account.oktaOpportunityType === 'expansion' ? 'Expansion' : 'Unknown'}
                              </span>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Revenue</label>
                            <p className="text-sm text-gray-900">{account.oktaEstimatedAnnualRevenue || 'Not set'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Employee Count</label>
                            <p className="text-sm text-gray-900">{account.oktaEstimatedUserVolume || 'Not set'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">SKUs</label>
                            <div className="flex flex-wrap gap-2">
                              {account.oktaSkus && account.oktaSkus.length > 0 ? (
                                account.oktaSkus.map(sku => (
                                  <span key={sku} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                    {sku}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No SKUs set</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">Use Cases</label>
                            <div className="flex flex-wrap gap-1">
                              {account.oktaUseCases && account.oktaUseCases.length > 0 ? (
                                account.oktaUseCases.map(uc => (
                                  <span key={uc} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                                    {uc}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No use cases</span>
                              )}
                            </div>
                          </div>
                          {account.oktaSdrNotes && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">{account.oktaSdrNotes}</p>
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
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Revenue</label>
                            <input
                              type="text"
                              value={oktaEditData.oktaEstimatedAnnualRevenue}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaEstimatedAnnualRevenue: e.target.value })}
                              placeholder="e.g., $10M-$50M"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Count</label>
                            <input
                              type="text"
                              value={oktaEditData.oktaEstimatedUserVolume}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaEstimatedUserVolume: e.target.value })}
                              placeholder="e.g., 500-1000"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Okta SKUs</label>
                            <select
                              multiple
                              value={oktaEditData.oktaSkus}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaSkus: Array.from(e.target.selectedOptions, option => option.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
                              size={5}
                            >
                              <option value="Workforce Identity Cloud">Workforce Identity Cloud</option>
                              <option value="Identity Governance">Identity Governance</option>
                              <option value="Privileged Access">Privileged Access</option>
                              <option value="Identity Threat Protection">Identity Threat Protection</option>
                              <option value="Okta for AI Agents">Okta for AI Agents</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Use Cases (comma-separated)</label>
                            <textarea
                              value={oktaEditData.oktaUseCases.join(', ')}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaUseCases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="SSO, MFA, Identity Governance..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                            <textarea
                              value={oktaEditData.oktaSdrNotes}
                              onChange={(e) => setOktaEditData({ ...oktaEditData, oktaSdrNotes: e.target.value })}
                              placeholder="Add notes..."
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleSaveOkta}
                              disabled={savingOkta}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 text-sm"
                            >
                              {savingOkta ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelOkta}
                              disabled={savingOkta}
                              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm"
                            >
                              Cancel
                            </button>
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
                        <button
                          onClick={() => setShowOktaAISuggestions(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          &times;
                        </button>
                      </div>
                      <p className="text-sm text-purple-700 mb-4">
                        This will call the Okta AI categorizer. Click &quot;Generate Suggestions&quot; below.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/accounts/${id}/okta-auto-categorize`, { method: 'POST' });
                            if (!res.ok) throw new Error('Failed to generate Okta suggestions');
                            const data = await res.json();
                            handleAcceptOktaAISuggestions(data.suggestions);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to generate suggestions');
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                      >
                        Generate Suggestions
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Research Sections — Auth0 Perspective */}
            {activePerspective === 'auth0' && (
              <>
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
                  />
                </div>

                <div id="section-users" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Customer Base & Scale"
                    content={account.customerBaseInfo}
                    icon={<UsersIcon />}
                  />
                </div>

                <div id="section-security" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Security & Compliance"
                    content={account.securityIncidents}
                    icon={<ShieldIcon />}
                  />
                </div>

                <div id="section-news" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Recent News & Funding"
                    content={account.newsAndFunding}
                    icon={<NewspaperIcon />}
                  />
                </div>

                <div id="section-tech" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Tech Transformation Initiatives"
                    content={account.techTransformation}
                    icon={<LightningIcon />}
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
                  />
                </div>

                <div id="section-users" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Workforce & IT Complexity"
                    content={account.oktaWorkforceInfo}
                    icon={<UsersIcon />}
                  />
                </div>

                <div id="section-security" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Security & Compliance"
                    content={account.oktaSecurityIncidents}
                    icon={<ShieldIcon />}
                  />
                </div>

                <div id="section-news" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Recent News & Funding"
                    content={account.oktaNewsAndFunding}
                    icon={<NewspaperIcon />}
                  />
                </div>

                <div id="section-tech" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Tech Transformation Initiatives"
                    content={account.oktaTechTransformation}
                    icon={<LightningIcon />}
                  />
                </div>

                <div id="section-ecosystem" className="scroll-mt-24 bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
                  <MarkdownSection
                    title="Okta Ecosystem & Relationship"
                    content={account.oktaEcosystem}
                    icon={<TargetIcon />}
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

            {/* Email Writer — always rendered inline */}
            <div id="section-email" className="scroll-mt-24 mb-8">
              <EmailWriter accountId={account.id} account={account} />
            </div>

            {/* Sequence Builder — always rendered inline */}
            <div id="section-sequence" className="scroll-mt-24 mb-8">
              <SequenceWriter accountId={account.id} account={account} />
            </div>
          </div>
        </div>
      ) : (
        /* Non-completed accounts: simple layout, no sidebar */
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/accounts')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
          >
            Back to Accounts
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Account
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        accountName={account.companyName}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />
    </main>
  );
}
