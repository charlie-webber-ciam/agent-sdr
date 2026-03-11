'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Parse date strings that may be DD/MM/YYYY, MM/DD/YYYY, or ISO format. */
function parseDate(raw: string): Date {
  const slashParts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashParts) {
    const [, day, month, year] = slashParts;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(raw);
}

interface OpportunityWithAccount {
  id: number;
  account_id: number;
  opportunity_name: string;
  stage: string | null;
  last_stage_change_date: string | null;
  business_use_case: string | null;
  champions: string | null;
  company_name: string;
  domain: string | null;
  industry: string;
  tier: string | null;
  okta_tier: string | null;
  prospect_count: number;
}

const STAGE_OPTIONS = [
  'Closed Won',
  'Closed Lost',
  'Negotiation',
  'Proposal',
  'Qualification',
  'Discovery',
  'Prospecting',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Needs Analysis',
];

function stageBadgeVariant(stage: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!stage) return 'outline';
  const value = stage.toLowerCase();
  if (value.includes('closed won')) return 'default';
  if (value.includes('closed lost')) return 'destructive';
  return 'secondary';
}

function tierBadgeVariant(tier: string | null): 'default' | 'secondary' | 'outline' {
  if (tier === 'A') return 'default';
  if (tier === 'B') return 'secondary';
  return 'outline';
}

const PAGE_SIZE = 50;

function OpportunitiesPageInner() {
  const searchParams = useSearchParams();

  const [opportunities, setOpportunities] = useState<OpportunityWithAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [tier, setTier] = useState(searchParams.get('tier') || '');
  const [industry] = useState(searchParams.get('industry') || '');
  const [offset, setOffset] = useState(parseInt(searchParams.get('offset') || '0', 10));

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stage) params.set('stage', stage);
    if (tier) params.set('tier', tier);
    if (industry) params.set('industry', industry);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    try {
      const res = await fetch(`/api/opportunities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOpportunities(data.opportunities);
      setTotal(data.total);
    } catch {
      setError('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [search, stage, tier, industry, offset]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const applyFilters = () => {
    setOffset(0);
    fetchOpportunities();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Opportunities</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} total opportunities across all accounts</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Search opportunity name, account, use case..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <Select
              value={stage || 'all'}
              onValueChange={(value) => {
                setStage(value === 'all' ? '' : value);
                setOffset(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tier || 'all'}
              onValueChange={(value) => {
                setTier(value === 'all' ? '' : value);
                setOffset(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : opportunities.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No opportunities found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead>Account</TableHead>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Last Stage Change</TableHead>
                    <TableHead>Champions</TableHead>
                    <TableHead>Use Case</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell>
                        <Link href={`/accounts/${opp.account_id}?tab=opportunities`} className="font-medium text-primary hover:underline">
                          {opp.company_name}
                        </Link>
                        <div className="mt-1 flex items-center gap-2">
                          {opp.tier && <Badge variant={tierBadgeVariant(opp.tier)}>{opp.tier}</Badge>}
                          <span className="text-xs text-muted-foreground">{opp.industry}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-foreground">
                        <span className="line-clamp-2">{opp.opportunity_name}</span>
                      </TableCell>
                      <TableCell>
                        {opp.stage ? <Badge variant={stageBadgeVariant(opp.stage)}>{opp.stage}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {opp.last_stage_change_date
                          ? parseDate(opp.last_stage_change_date).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-[160px] text-xs text-muted-foreground">
                        <span className="line-clamp-1">{opp.champions || '-'}</span>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                        <span className="line-clamp-2">{opp.business_use_case || '-'}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">{opp.prospect_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button
                  variant="outline"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Skeleton className="h-8 w-8 rounded-full" /></div>}>
      <OpportunitiesPageInner />
    </Suspense>
  );
}
