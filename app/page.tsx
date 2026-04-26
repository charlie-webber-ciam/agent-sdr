'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Filter,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
  XCircle,
} from 'lucide-react';

import { DashboardSkeleton } from '@/components/Skeleton';
import { usePerspective } from '@/lib/perspective-context';
import { useToast } from '@/lib/toast-context';
import { capitalize, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  archived: number;
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
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;

    const duration = 500;
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

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-700';
  }

  if (status === 'processing') {
    return 'border-blue-200 bg-blue-100 text-blue-700';
  }

  if (status === 'failed') {
    return 'border-red-200 bg-red-100 text-red-700';
  }

  if (status === 'pending') {
    return 'border-amber-200 bg-amber-100 text-amber-700';
  }

  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function GettingStartedStepper({ stats, hasJobs }: { stats: Stats; hasJobs: boolean }) {
  const steps = [
    { label: 'Upload accounts', description: 'Import a CSV of company accounts.', href: '/upload', done: stats.total > 0 },
    { label: 'Process research', description: 'Run AI research on your accounts.', href: '/upload', done: stats.completed > 0 },
    { label: 'Review accounts', description: 'Browse research results and tiers.', href: '/accounts', done: stats.completed > 3 },
    { label: 'Generate outreach', description: 'Create personalized emails.', href: '/bulk-email', done: false },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <motion.div variants={fadeSlide} initial="hidden" animate="show">
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Getting Started</CardTitle>
          <CardDescription>Follow these steps to set up your research pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <Link
                key={step.label}
                href={step.href}
                className={cn(
                  'group relative rounded-lg border p-3 transition-colors',
                  step.done
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <span className={cn('text-sm font-medium', step.done && 'text-emerald-700')}>
                    {step.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
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
  const [emptyCompletedCount, setEmptyCompletedCount] = useState(0);
  const [resettingEmpty, setResettingEmpty] = useState(false);
  const [interruptedActionLoading, setInterruptedActionLoading] = useState<number | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const [archivingJobId, setArchivingJobId] = useState<number | null>(null);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [pollInterval, setPollInterval] = useState(5000);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, jobsRes, preprocessRes, emptyRes] = await Promise.all([
        fetch('/api/stats'),
        fetch(`/api/jobs?limit=12${showArchivedJobs ? '&includeArchived=1' : ''}`),
        fetch('/api/preprocess/jobs'),
        fetch('/api/accounts/reset-empty'),
      ]);

      let fetchedJobs: Job[] = [];
      let fetchedPreprocessJobs: PreprocessingJob[] = [];

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setInterruptedJobs(statsData.interruptedJobs || []);
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        fetchedJobs = jobsData.jobs ?? [];
        setRecentJobs(fetchedJobs);
      }

      if (preprocessRes.ok) {
        const preprocessData = await preprocessRes.json();
        fetchedPreprocessJobs = preprocessData.jobs ?? [];
        setPreprocessingJobs(fetchedPreprocessJobs);
      }

      if (emptyRes.ok) {
        const emptyData = await emptyRes.json();
        setEmptyCompletedCount(emptyData.count ?? 0);
      }

      const hasActiveResearch = fetchedJobs.some((job) => job.status === 'processing' || job.status === 'pending');
      const hasActivePreprocess = fetchedPreprocessJobs.some((job) => job.status === 'processing' || job.status === 'pending');
      setPollInterval(hasActiveResearch || hasActivePreprocess ? 5000 : 15000);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [showArchivedJobs]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, fetchData]);

  const activeResearchJobs = useMemo(
    () => recentJobs.filter((job) => (job.status === 'processing' || job.status === 'pending') && job.archived !== 1),
    [recentJobs]
  );

  const activePreprocessingJobs = useMemo(
    () => preprocessingJobs.filter((job) => job.status === 'processing' || job.status === 'pending'),
    [preprocessingJobs]
  );

  const staleCount = useMemo(() => {
    if (!stats?.staleness) return 0;
    return stats.staleness.stale + stats.staleness.veryStale;
  }, [stats]);

  const uncategorizedCount = useMemo(
    () => (isOkta ? (stats?.oktaUncategorized ?? 0) : (stats?.uncategorized ?? 0)),
    [isOkta, stats]
  );

  const completionRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  const categorizedCoverage = useMemo(() => {
    if (!stats || stats.completed === 0) return 0;
    const categorized = Math.max(stats.completed - uncategorizedCount, 0);
    return Math.round((categorized / stats.completed) * 100);
  }, [stats, uncategorizedCount]);

  const activeWorkCount = activeResearchJobs.length + activePreprocessingJobs.length + interruptedJobs.length;
  const tierParam = isOkta ? 'oktaTier' : 'tier';

  const handleRefreshStale = async () => {
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
  };

  const handleResetEmpty = async () => {
    setResettingEmpty(true);
    try {
      const res = await fetch('/api/accounts/reset-empty', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Reset ${data.resetCount} account${data.resetCount !== 1 ? 's' : ''} for re-processing`);
        setEmptyCompletedCount(0);
        await fetchData();
      } else {
        toast.error('Failed to reset accounts');
      }
    } catch {
      toast.error('Failed to reset accounts');
    } finally {
      setResettingEmpty(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <motion.div
        className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        variants={fadeSlide}
        initial="hidden"
        animate="show"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Focused operational view for active jobs and data health.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{isOkta ? 'Okta' : 'Auth0'} workspace</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchivedJobs((prev) => !prev)}
          >
            {showArchivedJobs ? 'Hide archived jobs' : 'Show archived jobs'}
          </Button>
          {activeWorkCount > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
              {activeWorkCount} item{activeWorkCount !== 1 ? 's' : ''} in flight
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700">
              Pipeline clear
            </Badge>
          )}
        </div>
      </motion.div>

      {stats && (
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeSlide}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Tracked accounts
                </CardDescription>
                <CardTitle className="text-3xl"><AnimatedNumber value={stats.total} /></CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground"><AnimatedNumber value={stats.completed} /></span> completed
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeSlide}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  In flight
                </CardDescription>
                <CardTitle className="text-3xl"><AnimatedNumber value={stats.processing + stats.pending} /></CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {stats.processing} processing · {stats.pending} pending
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeSlide}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Completion rate
                </CardDescription>
                <CardTitle className="text-3xl">
                  <AnimatedNumber value={completionRate} />%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {stats.completed} of {stats.total} processed
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeSlide}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Failed
                </CardDescription>
                <CardTitle className="text-3xl"><AnimatedNumber value={stats.failed} /></CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Use Reprocess for retries or reruns</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {stats && stats.total < 10 && (
        <GettingStartedStepper stats={stats} hasJobs={recentJobs.length > 0} />
      )}

      <motion.div
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeSlide} className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Priority Queue
              </CardTitle>
              <CardDescription>Only high-signal actions remain on dashboard. Tool launchers live in sidebar navigation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Interrupted jobs</p>
                    <p className="text-xs text-muted-foreground">
                      Resume or cancel stalled research/categorization runs.
                    </p>
                  </div>
                  <Badge variant={interruptedJobs.length > 0 ? 'destructive' : 'secondary'}>
                    {interruptedJobs.length}
                  </Badge>
                </div>
                {interruptedJobs.length > 0 && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <a href="#interrupted-jobs">Review interrupted jobs</a>
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Uncategorized accounts</p>
                    <p className="text-xs text-muted-foreground">
                      Categorization coverage is <span className="font-medium text-foreground">{categorizedCoverage}%</span> for completed accounts.
                    </p>
                  </div>
                  <Badge variant={uncategorizedCount > 0 ? 'outline' : 'secondary'}>{uncategorizedCount}</Badge>
                </div>
                {uncategorizedCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => router.push('/categorize')}>Auto-categorize</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/accounts?status=completed&${tierParam}=unassigned`)}
                    >
                      Review in Accounts
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Research freshness</p>
                    <p className="text-xs text-muted-foreground">Accounts stale for 60+ days should be refreshed.</p>
                  </div>
                  <Badge variant={staleCount > 0 ? 'outline' : 'secondary'}>{staleCount}</Badge>
                </div>
                {staleCount > 0 && (
                  <Button onClick={handleRefreshStale} disabled={refreshingStale} variant="outline" size="sm" className="mt-3">
                    {refreshingStale && <Loader2 className="h-4 w-4 animate-spin" />}
                    {refreshingStale ? 'Starting refresh...' : `Refresh ${staleCount} stale account${staleCount !== 1 ? 's' : ''}`}
                  </Button>
                )}
              </div>

              {emptyCompletedCount > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-red-800">Empty research data detected</p>
                      <p className="text-xs text-muted-foreground">
                        {emptyCompletedCount} account{emptyCompletedCount !== 1 ? 's' : ''} marked as completed but contain{emptyCompletedCount === 1 ? 's' : ''} no
                        actual research data. Likely caused by token budget exhaustion during processing.
                      </p>
                    </div>
                    <Badge variant="destructive">{emptyCompletedCount}</Badge>
                  </div>
                  <Button
                    onClick={handleResetEmpty}
                    disabled={resettingEmpty}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    {resettingEmpty ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    {resettingEmpty ? 'Resetting...' : 'Reset for re-processing'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeSlide}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detail Moved Out Of Dashboard</CardTitle>
              <CardDescription>
                Tier/SKU deep dives and pipeline exploration are now handled in dedicated pages with richer filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/accounts">
                  Accounts
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/opportunities">
                  Opportunities
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/upload">
                  Upload New Batch
                  <Upload className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {interruptedJobs.length > 0 && (
        <motion.div id="interrupted-jobs" variants={fadeSlide} initial="hidden" animate="show">
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Interrupted Jobs
              </CardTitle>
              <CardDescription>These jobs were marked processing but are no longer active.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {interruptedJobs.map((job) => (
                <div key={`${job.type}-${job.id}`} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {job.type === 'research' ? 'Research' : 'Categorization'}: {job.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.processedCount} / {job.totalCount} processed
                        {job.pendingRemaining > 0 ? ` · ${job.pendingRemaining} remaining` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {job.type === 'research' ? (
                        <>
                          <Button
                            size="sm"
                            disabled={interruptedActionLoading === job.id}
                            onClick={async () => {
                              setInterruptedActionLoading(job.id);
                              try {
                                const res = await fetch('/api/process/restart', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ jobId: job.id }),
                                });

                                if (res.ok) {
                                  toast.success('Research job resumed');
                                  router.push(`/processing/${job.id}`);
                                } else {
                                  toast.error('Failed to resume research job');
                                }
                              } catch {
                                toast.error('Failed to resume research job');
                              } finally {
                                setInterruptedActionLoading(null);
                              }
                            }}
                          >
                            {interruptedActionLoading === job.id ? 'Resuming...' : 'Resume'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={interruptedActionLoading === job.id}
                            onClick={async () => {
                              setInterruptedActionLoading(job.id);
                              try {
                                const res = await fetch(`/api/process/${job.id}/cancel`, { method: 'POST' });
                                if (res.ok) {
                                  toast.success('Research job cancelled');
                                  setInterruptedJobs((prev) => prev.filter((j) => !(j.type === 'research' && j.id === job.id)));
                                } else {
                                  toast.error('Failed to cancel job');
                                }
                              } catch {
                                toast.error('Failed to cancel job');
                              } finally {
                                setInterruptedActionLoading(null);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={interruptedActionLoading === job.id}
                            onClick={async () => {
                              setInterruptedActionLoading(job.id);
                              try {
                                const res = await fetch('/api/categorization/restart', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ jobId: job.id }),
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
                          >
                            {interruptedActionLoading === job.id ? 'Restarting...' : 'Restart'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={interruptedActionLoading === job.id}
                            onClick={async () => {
                              setInterruptedActionLoading(job.id);
                              try {
                                const res = await fetch('/api/categorization/restart', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ jobId: job.id, cancelOnly: true }),
                                });

                                if (res.ok) {
                                  toast.success('Categorization job cancelled');
                                  setInterruptedJobs((prev) => prev.filter((j) => !(j.type === 'categorization' && j.id === job.id)));
                                } else {
                                  toast.error('Failed to cancel job');
                                }
                              } catch {
                                toast.error('Failed to cancel job');
                              } finally {
                                setInterruptedActionLoading(null);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(activeResearchJobs.length > 0 || activePreprocessingJobs.length > 0) && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Work</CardTitle>
              <CardDescription>Jobs currently running or queued.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Research uploads</p>
                  <Badge variant="outline">{activeResearchJobs.length}</Badge>
                </div>
                {activeResearchJobs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    No active research uploads.
                  </p>
                ) : (
                  activeResearchJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => router.push(`/processing/${job.id}`)}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{job.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.processedCount} / {job.totalAccounts} processed · {formatTimestamp(job.createdAt)}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <Badge variant="outline" className={statusBadgeClass(job.status)}>
                          {capitalize(job.status)}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Preprocessing</p>
                  <Badge variant="outline">{activePreprocessingJobs.length}</Badge>
                </div>
                {activePreprocessingJobs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    No active preprocessing jobs.
                  </p>
                ) : (
                  activePreprocessingJobs.map((job) => {
                    const progressPercent = job.total_accounts > 0
                      ? Math.round((job.processed_count / job.total_accounts) * 100)
                      : 0;

                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => router.push(`/preprocess/progress/${job.id}`)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{job.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.processed_count} / {job.total_accounts} validated
                              {job.removed_count > 0 ? ` · ${job.removed_count} removed` : ''}
                            </p>
                            {job.current_company && (
                              <p className="truncate text-xs text-muted-foreground">Current: {job.current_company}</p>
                            )}
                          </div>
                          <Badge variant="outline" className={statusBadgeClass(job.status)}>
                            {capitalize(job.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stats?.staleness && stats.completed > 0 && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Freshness Snapshot</CardTitle>
              <CardDescription>Quick quality signal for research recency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                {(() => {
                  const data = stats.staleness!;
                  const total = data.fresh + data.aging + data.stale + data.veryStale;

                  if (total === 0) {
                    return <div className="h-full w-full bg-muted" />;
                  }

                  return (
                    <div className="flex h-full w-full">
                      {data.fresh > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(data.fresh / total) * 100}%` }} />}
                      {data.aging > 0 && <div className="h-full bg-amber-400" style={{ width: `${(data.aging / total) * 100}%` }} />}
                      {data.stale > 0 && <div className="h-full bg-orange-500" style={{ width: `${(data.stale / total) * 100}%` }} />}
                      {data.veryStale > 0 && <div className="h-full bg-red-500" style={{ width: `${(data.veryStale / total) * 100}%` }} />}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border bg-emerald-50 p-3 text-center">
                  <p className="text-lg font-semibold text-emerald-700"><AnimatedNumber value={stats.staleness.fresh} /></p>
                  <p className="text-xs text-muted-foreground">Fresh &lt;30d</p>
                </div>
                <div className="rounded-md border border-border bg-amber-50 p-3 text-center">
                  <p className="text-lg font-semibold text-amber-700"><AnimatedNumber value={stats.staleness.aging} /></p>
                  <p className="text-xs text-muted-foreground">Aging 30-60d</p>
                </div>
                <div className="rounded-md border border-border bg-orange-50 p-3 text-center">
                  <p className="text-lg font-semibold text-orange-700"><AnimatedNumber value={stats.staleness.stale} /></p>
                  <p className="text-xs text-muted-foreground">Stale 60-90d</p>
                </div>
                <div className="rounded-md border border-border bg-red-50 p-3 text-center">
                  <p className="text-lg font-semibold text-red-700"><AnimatedNumber value={stats.staleness.veryStale} /></p>
                  <p className="text-xs text-muted-foreground">Very stale 90+d</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(recentJobs.length > 0 || showArchivedJobs) && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Uploads</CardTitle>
              <CardDescription>
                Latest jobs with quick access, archive, and cleanup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentJobs.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  No jobs to display.
                </p>
              ) : (
                recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col gap-3 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/processing/${job.id}`)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{job.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.processedCount} / {job.totalAccounts} processed · {formatTimestamp(job.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.archived === 1 && (
                          <Badge variant="outline" className="shrink-0 border-slate-300 bg-slate-100 text-slate-700">
                            Archived
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn('shrink-0', statusBadgeClass(job.status))}>
                          {capitalize(job.status)}
                        </Badge>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={archivingJobId === job.id || deletingJobId === job.id}
                        onClick={async () => {
                          setArchivingJobId(job.id);
                          try {
                            const isArchived = job.archived === 1;
                            const res = await fetch(`/api/process/${job.id}/archive`, {
                              method: isArchived ? 'DELETE' : 'POST',
                            });
                            if (res.ok) {
                              toast.success(isArchived ? 'Job unarchived' : 'Job archived');
                              await fetchData();
                            } else {
                              const data = await res.json().catch(() => ({}));
                              toast.error(data.error || `Failed to ${isArchived ? 'unarchive' : 'archive'} job`);
                            }
                          } catch {
                            toast.error('Failed to update job archive state');
                          } finally {
                            setArchivingJobId(null);
                          }
                        }}
                      >
                        {archivingJobId === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        <span>{job.archived === 1 ? 'Unarchive' : 'Archive'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingJobId === job.id || archivingJobId === job.id}
                        onClick={async () => {
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
                      >
                        {deletingJobId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                        <span>Delete</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => router.push(`/processing/${job.id}`)}>
                        Open
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!stats && recentJobs.length === 0 && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          <Card>
            <CardContent className="py-14 text-center">
              <div className="mx-auto max-w-md space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No data yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your first CSV to begin account research.
                </p>
                <Button onClick={() => router.push('/upload')}>Upload accounts</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stats && recentJobs.length === 0 && activeWorkCount === 0 && (
        <motion.div variants={fadeSlide} initial="hidden" animate="show">
          <Card className="border-dashed">
            <CardContent className="flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Everything is caught up.</p>
                <p className="text-xs text-muted-foreground">Start new research or explore account-level opportunities.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/accounts">
                    <Filter className="h-4 w-4" />
                    View accounts
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/upload">Upload next batch</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </main>
  );
}
