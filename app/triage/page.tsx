'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TriageJobSummary {
  id: number;
  filename: string;
  processingJobId: number | null;
  totalAccounts: number;
  processedCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'processing') return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TriageListPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<TriageJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/triage/list');
        if (!res.ok) throw new Error('Failed to fetch triage jobs');
        const data = await res.json();
        setJobs(data.jobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load triage jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const navigateToJob = (job: TriageJobSummary) => {
    if (job.status === 'completed' || job.status === 'failed') {
      if (job.processingJobId) {
        router.push(`/triage/results/${job.id}?processingJobId=${job.processingJobId}`);
      } else {
        router.push(`/triage/progress/${job.id}`);
      }
    } else if (job.processingJobId) {
      router.push(`/triage/progress/${job.id}?processingJobId=${job.processingJobId}`);
    } else {
      router.push(`/triage/progress/${job.id}`);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Triage Jobs</h1>
        <p className="text-sm text-muted-foreground">View all account triage runs and their results</p>
      </div>

      {loading && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-foreground">No triage jobs yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Upload accounts and run triage to see results here.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {jobs.map((job) => {
              const successCount = job.processedCount - job.failedCount;
              return (
                <button
                  key={job.id}
                  onClick={() => navigateToJob(job)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-3">
                      <h3 className="truncate font-semibold text-foreground">{job.filename}</h3>
                      <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>{job.totalAccounts} accounts</span>
                      {job.processedCount > 0 && <span>{successCount} triaged</span>}
                      {job.failedCount > 0 && <span className="text-destructive">{job.failedCount} failed</span>}
                      <span>{formatDate(job.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
