'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { DashboardSkeleton } from '@/components/Skeleton';
import { usePerspective } from '@/lib/perspective-context';
import { useToast } from '@/lib/toast-context';

interface InterruptedJob {
  id: number;
  type: 'research' | 'categorization';
  name: string;
  processedCount: number;
  totalCount: number;
  pendingRemaining: number;
}

interface StalenessStats {
  fresh: number;
  aging: number;
  stale: number;
  veryStale: number;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  tierA?: number;
  tierB?: number;
  tierC?: number;
  uncategorized?: number;
  skuCore?: number;
  skuFGA?: number;
  skuAuthForAI?: number;
  // Okta stats
  oktaTierA?: number;
  oktaTierB?: number;
  oktaTierC?: number;
  oktaUncategorized?: number;
  oktaSkuWorkforce?: number;
  oktaSkuGovernance?: number;
  oktaSkuPrivilegedAccess?: number;
  oktaSkuThreatProtection?: number;
  oktaSkuAIAgents?: number;
  staleness?: StalenessStats;
}

interface Job {
  id: number;
  filename: string;
  status: string;
  totalAccounts: number;
  processedCount: number;
  createdAt: string;
}

interface PreprocessingJob {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_accounts: number;
  processed_count: number;
  removed_count: number;
  current_company: string | null;
}

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const fadeSlide = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    prevRef.current = end;
  }, [value]);

  return <>{display}</>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { perspective } = usePerspective();
  const toast = useToast();
  const isOkta = perspective === 'okta';
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [preprocessingJobs, setPreprocessingJobs] = useState<PreprocessingJob[]>([]);
  const [interruptedJobs, setInterruptedJobs] = useState<InterruptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingStale, setRefreshingStale] = useState(false);
  const [interruptedActionLoading, setInterruptedActionLoading] = useState<number | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const pollIntervalRef = useRef<number>(5000);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          setInterruptedJobs(statsData.interruptedJobs || []);
        }

        const jobsRes = await fetch('/api/jobs');
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setRecentJobs(jobsData.jobs);
        }

        const preprocessRes = await fetch('/api/preprocess/jobs');
        if (preprocessRes.ok) {
          const preprocessData = await preprocessRes.json();
          const jobs = preprocessData.jobs;
          setPreprocessingJobs(jobs);

          const hasActive = jobs.some((job: PreprocessingJob) => job.status === 'processing' || job.status === 'pending');
          pollIntervalRef.current = hasActive ? 5000 : 15000;
          return hasActive;
        }
        return false;
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        return false;
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    let interval: NodeJS.Timeout;
    const startPolling = () => {
      interval = setInterval(async () => {
        await fetchData();
      }, pollIntervalRef.current);
    };
    startPolling();

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const primaryActions = [
    {
      label: 'Quick Research',
      desc: 'Research a single account instantly',
      href: '/quick-research',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      accent: 'border-indigo-200 hover:border-indigo-400',
      iconBg: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Upload for Research',
      desc: 'Start deep research on validated accounts',
      href: '/upload',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      accent: 'border-blue-200 hover:border-blue-400',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Browse Accounts',
      desc: 'View and search all researched accounts',
      href: '/accounts',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      accent: 'border-green-200 hover:border-green-400',
      iconBg: 'bg-green-100 text-green-600',
    },
  ];

  const secondaryActions = [
    { label: 'Preprocess', href: '/preprocess', icon: '🔍' },
    { label: 'Bulk Categorize', href: '/categorize', icon: '📋' },
    { label: 'Bulk Reprocess', href: '/reprocess', icon: '🔄' },
    { label: 'Employee Counts', href: '/employee-counts/jobs', icon: '👥' },
  ];

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div className="mb-8" variants={fadeSlide} initial="hidden" animate="show">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Manage and track your account research
        </p>
      </motion.div>

      {/* Primary Actions */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {primaryActions.map((action) => (
          <motion.button
            key={action.label}
            variants={fadeSlide}
            onClick={() => router.push(action.href)}
            className={`bg-white border ${action.accent} rounded-xl p-6 text-left transition-all hover:scale-[1.01] hover:shadow-lg group`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${action.iconBg}`}>
                {action.icon}
              </div>
              <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{action.label}</h2>
            <p className="text-sm text-gray-600">{action.desc}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Secondary Actions */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {secondaryActions.map((action) => (
          <motion.button
            key={action.label}
            variants={fadeSlide}
            onClick={() => router.push(action.href)}
            className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-left transition-all hover:bg-gray-50 group flex items-center gap-3"
          >
            <span className="text-lg">{action.icon}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Interrupted Jobs Banner */}
      {interruptedJobs.length > 0 && (
        <motion.div
          className="bg-amber-50 border border-amber-300 rounded-xl p-6 mb-8"
          variants={fadeSlide}
          initial="hidden"
          animate="show"
        >
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-bold text-amber-800">Attention Needed</h3>
          </div>
          <div className="space-y-3">
            {interruptedJobs.map((ij) => (
              <div key={`${ij.type}-${ij.id}`} className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ij.type === 'research' ? 'Research' : 'Categorization'} job was interrupted
                    {ij.pendingRemaining > 0 && ` with ${ij.pendingRemaining} account${ij.pendingRemaining !== 1 ? 's' : ''} remaining`}.
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{ij.name} &mdash; {ij.processedCount} / {ij.totalCount} processed</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ij.type === 'research' ? (
                    <>
                      <button
                        disabled={interruptedActionLoading === ij.id}
                        onClick={async () => {
                          setInterruptedActionLoading(ij.id);
                          try {
                            const res = await fetch('/api/process/restart', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ jobId: ij.id }),
                            });
                            if (res.ok) {
                              toast.success('Research job resumed');
                              router.push(`/processing/${ij.id}`);
                            } else {
                              toast.error('Failed to resume research job');
                            }
                          } catch {
                            toast.error('Failed to resume research job');
                          } finally {
                            setInterruptedActionLoading(null);
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:bg-gray-300 transition-colors"
                      >
                        {interruptedActionLoading === ij.id ? 'Resuming...' : 'Resume'}
                      </button>
                      <button
                        disabled={interruptedActionLoading === ij.id}
                        onClick={async () => {
                          setInterruptedActionLoading(ij.id);
                          try {
                            const res = await fetch(`/api/process/${ij.id}/cancel`, { method: 'POST' });
                            if (res.ok) {
                              toast.success('Research job cancelled');
                              setInterruptedJobs((prev) => prev.filter((j) => !(j.type === 'research' && j.id === ij.id)));
                            } else {
                              toast.error('Failed to cancel job');
                            }
                          } catch {
                            toast.error('Failed to cancel job');
                          } finally {
                            setInterruptedActionLoading(null);
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium disabled:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={interruptedActionLoading === ij.id}
                        onClick={async () => {
                          setInterruptedActionLoading(ij.id);
                          try {
                            const res = await fetch('/api/categorization/restart', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ jobId: ij.id }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              toast.success('Categorization job restarted');
                              router.push(`/categorize/progress/${data.newJobId}`);
                            } else {
                              toast.error('Failed to restart categorization job');
                            }
                          } catch {
                            toast.error('Failed to restart categorization job');
                          } finally {
                            setInterruptedActionLoading(null);
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:bg-gray-300 transition-colors"
                      >
                        {interruptedActionLoading === ij.id ? 'Restarting...' : 'Restart'}
                      </button>
                      <button
                        disabled={interruptedActionLoading === ij.id}
                        onClick={async () => {
                          setInterruptedActionLoading(ij.id);
                          try {
                            const res = await fetch('/api/categorization/restart', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ jobId: ij.id, cancelOnly: true }),
                            });
                            if (res.ok) {
                              toast.success('Categorization job cancelled');
                              setInterruptedJobs((prev) => prev.filter((j) => !(j.type === 'categorization' && j.id === ij.id)));
                            } else {
                              toast.error('Failed to cancel job');
                            }
                          } catch {
                            toast.error('Failed to cancel job');
                          } finally {
                            setInterruptedActionLoading(null);
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium disabled:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {stats && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          {/* Basic Stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-6 text-gray-900">Account Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <div className="text-3xl font-bold text-gray-900"><AnimatedNumber value={stats.total} /></div>
                <div className="text-sm text-gray-600 mt-1">Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border-l-2 border-green-200">
                <div className="text-3xl font-bold text-green-600"><AnimatedNumber value={stats.completed} /></div>
                <div className="text-sm text-gray-600 mt-1">Completed</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border-l-2 border-blue-200">
                <div className="text-3xl font-bold text-blue-600"><AnimatedNumber value={stats.processing} /></div>
                <div className="text-sm text-gray-600 mt-1">Processing</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border-l-2 border-yellow-200">
                <div className="text-3xl font-bold text-yellow-600"><AnimatedNumber value={stats.pending} /></div>
                <div className="text-sm text-gray-600 mt-1">Pending</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border-l-2 border-red-200">
                <div className="text-3xl font-bold text-red-600"><AnimatedNumber value={stats.failed} /></div>
                <div className="text-sm text-gray-600 mt-1">Failed</div>
              </div>
            </div>
          </div>

          {/* SDR Analytics */}
          {stats.completed > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Tier Distribution */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900">{isOkta ? 'Okta' : 'Auth0'} Portfolio Distribution</h3>
                <div className="space-y-4">
                  {/* Tier bar visualization */}
                  {(() => {
                    const tA = isOkta ? (stats.oktaTierA || 0) : (stats.tierA || 0);
                    const tB = isOkta ? (stats.oktaTierB || 0) : (stats.tierB || 0);
                    const tC = isOkta ? (stats.oktaTierC || 0) : (stats.tierC || 0);
                    const total = tA + tB + tC;
                    const pctA = total > 0 ? (tA / total) * 100 : 0;
                    const pctB = total > 0 ? (tB / total) * 100 : 0;
                    const pctC = total > 0 ? (tC / total) * 100 : 0;
                    return (
                      <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
                        {pctA > 0 && <div className="bg-green-500 transition-all duration-500" style={{ width: `${pctA}%` }} />}
                        {pctB > 0 && <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pctB}%` }} />}
                        {pctC > 0 && <div className="bg-gray-500 transition-all duration-500" style={{ width: `${pctC}%` }} />}
                      </div>
                    );
                  })()}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="font-medium text-gray-700">Tier A</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900"><AnimatedNumber value={isOkta ? (stats.oktaTierA || 0) : (stats.tierA || 0)} /></span>
                        <span className="text-sm text-gray-500">
                          ({stats.completed ? Math.round(((isOkta ? (stats.oktaTierA || 0) : (stats.tierA || 0)) / stats.completed) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span className="font-medium text-gray-700">Tier B</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900"><AnimatedNumber value={isOkta ? (stats.oktaTierB || 0) : (stats.tierB || 0)} /></span>
                        <span className="text-sm text-gray-500">
                          ({stats.completed ? Math.round(((isOkta ? (stats.oktaTierB || 0) : (stats.tierB || 0)) / stats.completed) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-500 rounded"></div>
                        <span className="font-medium text-gray-700">Tier C</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900"><AnimatedNumber value={isOkta ? (stats.oktaTierC || 0) : (stats.tierC || 0)} /></span>
                        <span className="text-sm text-gray-500">
                          ({stats.completed ? Math.round(((isOkta ? (stats.oktaTierC || 0) : (stats.tierC || 0)) / stats.completed) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const uncatCount = isOkta ? (stats.oktaUncategorized ?? 0) : (stats.uncategorized ?? 0);
                    const tierParam = isOkta ? 'oktaTier' : 'tier';
                    if (uncatCount <= 0) return null;
                    return (
                      <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-yellow-600">Needs Categorization</span>
                          <span className="text-lg font-bold text-yellow-700">{uncatCount}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push('/categorize')}
                            className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium transition-colors"
                          >
                            Auto-Categorize
                          </button>
                          <button
                            onClick={() => router.push(`/accounts?status=completed&${tierParam}=unassigned`)}
                            className="flex-1 px-3 py-2 bg-gray-100 border border-yellow-300 text-yellow-600 rounded hover:bg-gray-200 text-sm font-medium transition-colors"
                          >
                            Review Manually
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SKU Opportunities */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900">{isOkta ? 'Okta SKU Opportunities' : 'Auth0 SKU Opportunities'}</h3>
                <div className="space-y-3">
                  {isOkta ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div>
                          <div className="font-bold text-purple-700">Workforce Identity Cloud</div>
                          <div className="text-xs text-purple-500">SSO, MFA, Lifecycle Management</div>
                        </div>
                        <div className="text-2xl font-bold text-purple-700"><AnimatedNumber value={stats.oktaSkuWorkforce || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div>
                          <div className="font-bold text-indigo-700">Identity Governance</div>
                          <div className="text-xs text-indigo-500">Access Certification, Workflows</div>
                        </div>
                        <div className="text-2xl font-bold text-indigo-700"><AnimatedNumber value={stats.oktaSkuGovernance || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg">
                        <div>
                          <div className="font-bold text-pink-700">Privileged Access</div>
                          <div className="text-xs text-pink-500">PAM, Session Management</div>
                        </div>
                        <div className="text-2xl font-bold text-pink-700"><AnimatedNumber value={stats.oktaSkuPrivilegedAccess || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div>
                          <div className="font-bold text-amber-700">Identity Threat Protection</div>
                          <div className="text-xs text-amber-500">Continuous Risk Assessment</div>
                        </div>
                        <div className="text-2xl font-bold text-amber-700"><AnimatedNumber value={stats.oktaSkuThreatProtection || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
                        <div>
                          <div className="font-bold text-teal-700">Okta for AI Agents</div>
                          <div className="text-xs text-teal-500">AI Agent Identity & Auth</div>
                        </div>
                        <div className="text-2xl font-bold text-teal-700"><AnimatedNumber value={stats.oktaSkuAIAgents || 0} /></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div>
                          <div className="font-bold text-purple-700">Core CIAM</div>
                          <div className="text-xs text-purple-500">SSO, MFA, User Management</div>
                        </div>
                        <div className="text-2xl font-bold text-purple-700"><AnimatedNumber value={stats.skuCore || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div>
                          <div className="font-bold text-indigo-700">FGA</div>
                          <div className="text-xs text-indigo-500">Fine-Grained Authorization</div>
                        </div>
                        <div className="text-2xl font-bold text-indigo-700"><AnimatedNumber value={stats.skuFGA || 0} /></div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg">
                        <div>
                          <div className="font-bold text-pink-700">Auth for AI</div>
                          <div className="text-xs text-pink-500">LLM & AI Agent Auth</div>
                        </div>
                        <div className="text-2xl font-bold text-pink-700"><AnimatedNumber value={stats.skuAuthForAI || 0} /></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Research Freshness */}
      {stats && stats.staleness && stats.completed > 0 && (
        <motion.div
          className="bg-white border border-gray-200 rounded-xl p-6 mb-8"
          variants={fadeSlide}
          initial="hidden"
          animate="show"
        >
          <h3 className="text-lg font-bold mb-4 text-gray-900">Research Freshness</h3>
          {/* Compact bar visualization */}
          {(() => {
            const s = stats.staleness!;
            const total = s.fresh + s.aging + s.stale + s.veryStale;
            if (total === 0) return null;
            return (
              <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 mb-4">
                {s.fresh > 0 && <div className="bg-green-500 transition-all duration-500" style={{ width: `${(s.fresh / total) * 100}%` }} title={`Fresh: ${s.fresh}`} />}
                {s.aging > 0 && <div className="bg-yellow-500 transition-all duration-500" style={{ width: `${(s.aging / total) * 100}%` }} title={`Aging: ${s.aging}`} />}
                {s.stale > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${(s.stale / total) * 100}%` }} title={`Stale: ${s.stale}`} />}
                {s.veryStale > 0 && <div className="bg-red-700 transition-all duration-500" style={{ width: `${(s.veryStale / total) * 100}%` }} title={`Very Stale: ${s.veryStale}`} />}
              </div>
            );
          })()}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600"><AnimatedNumber value={stats.staleness.fresh} /></div>
              <div className="text-xs text-gray-600 mt-1">Fresh (&lt;30d)</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600"><AnimatedNumber value={stats.staleness.aging} /></div>
              <div className="text-xs text-gray-600 mt-1">Aging (30-60d)</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600"><AnimatedNumber value={stats.staleness.stale} /></div>
              <div className="text-xs text-gray-600 mt-1">Stale (60-90d)</div>
            </div>
            <div className="text-center p-3 bg-red-100 rounded-lg">
              <div className="text-2xl font-bold text-red-700"><AnimatedNumber value={stats.staleness.veryStale} /></div>
              <div className="text-xs text-gray-600 mt-1">Very Stale (&gt;90d)</div>
            </div>
          </div>
          {(stats.staleness.stale + stats.staleness.veryStale) > 0 && (
            <button
              onClick={async () => {
                setRefreshingStale(true);
                try {
                  const res = await fetch('/api/accounts/refresh-stale', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ thresholdDays: 60, limit: 100 }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    router.push(data.redirectUrl);
                  } else {
                    const data = await res.json();
                    toast.error(data.error || 'Failed to refresh stale accounts');
                  }
                } catch {
                  toast.error('Failed to refresh stale accounts');
                } finally {
                  setRefreshingStale(false);
                }
              }}
              disabled={refreshingStale}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {refreshingStale ? 'Starting Refresh...' : `Refresh ${stats.staleness.stale + stats.staleness.veryStale} Stale Accounts`}
            </button>
          )}
        </motion.div>
      )}

      {/* Active Preprocessing Jobs */}
      {preprocessingJobs.filter(job => job.status === 'processing' || job.status === 'pending').length > 0 && (
        <motion.div
          className="bg-white border border-purple-300 rounded-xl mb-8"
          variants={fadeSlide}
          initial="hidden"
          animate="show"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Active Preprocessing</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Validating and cleaning account lists
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-600 border border-purple-300 rounded-full text-sm font-medium animate-pulse">
                In Progress
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {preprocessingJobs
              .filter(job => job.status === 'processing' || job.status === 'pending')
              .map((job) => {
                const progressPercent = job.total_accounts > 0
                  ? Math.round((job.processed_count / job.total_accounts) * 100)
                  : 0;
                return (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/preprocess/progress/${job.id}`)}
                    className="p-4 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-lg text-gray-900">{job.filename}</h3>
                        <p className="text-sm text-gray-600">
                          {job.processed_count} / {job.total_accounts} accounts validated
                          {job.removed_count > 0 && ` · ${job.removed_count} removed`}
                        </p>
                        {job.current_company && (
                          <p className="text-xs text-purple-600 mt-1">
                            Currently validating: {job.current_company}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          job.status === 'processing'
                            ? 'bg-blue-100 text-blue-600 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}>
                          {job.status === 'processing' ? 'Processing' : 'Pending'}
                        </span>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <motion.div
          className="bg-white border border-gray-200 rounded-xl"
          variants={fadeSlide}
          initial="hidden"
          animate="show"
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Uploads</h2>
          </div>
          <motion.div className="divide-y divide-gray-200" variants={stagger} initial="hidden" animate="show">
            {recentJobs.map((job) => (
              <motion.div
                key={job.id}
                variants={fadeSlide}
                onClick={() => router.push(`/processing/${job.id}`)}
                className="p-4 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-lg text-gray-900">{job.filename}</h3>
                    <p className="text-sm text-gray-600">
                      {job.processedCount} / {job.totalAccounts} accounts processed
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-600 border border-green-300'
                        : job.status === 'processing'
                        ? 'bg-blue-100 text-blue-600 border border-blue-300'
                        : job.status === 'failed'
                        ? 'bg-red-100 text-red-600 border border-red-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                    <button
                      disabled={deletingJobId === job.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete job "${job.filename}" and all its accounts?`)) return;
                        setDeletingJobId(job.id);
                        try {
                          const res = await fetch(`/api/process/${job.id}/delete`, { method: 'DELETE' });
                          if (res.ok) {
                            setRecentJobs((prev) => prev.filter((j) => j.id !== job.id));
                            toast.success('Job deleted');
                          } else {
                            toast.error('Failed to delete job');
                          }
                        } catch {
                          toast.error('Failed to delete job');
                        } finally {
                          setDeletingJobId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete job"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Empty State */}
      {!stats && recentJobs.length === 0 && (
        <motion.div
          className="bg-white border border-gray-200 rounded-xl p-12 text-center"
          variants={fadeSlide}
          initial="hidden"
          animate="show"
        >
          <div className="max-w-md mx-auto">
            <svg className="mx-auto h-16 w-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Started</h3>
            <p className="text-gray-600 mb-6">
              Upload your first CSV file to start researching accounts with AI
            </p>
            <button
              onClick={() => router.push('/upload')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Upload Accounts
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}
