import type { Account } from '../db';

export interface EnrichmentResult {
  success: boolean;
  updates: Record<string, any>;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  error?: string;
}

export type EnrichmentHandler = (account: Account) => Promise<EnrichmentResult>;

export interface EnrichmentAgentConfig {
  name: string;
  description: string;
  handler: EnrichmentHandler;
  /** Default filter to apply when querying accounts for this enrichment type */
  defaultFilter?: Record<string, any>;
}
