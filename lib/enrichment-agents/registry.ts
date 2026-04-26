import { EnrichmentAgentConfig } from './types';
import { findDomain } from './find-domain';
import { standardizeIndustry } from './standardize-industry';

const registry = new Map<string, EnrichmentAgentConfig>();

export function registerEnrichmentAgent(type: string, config: EnrichmentAgentConfig): void {
  registry.set(type, config);
}

export function getEnrichmentAgent(type: string): EnrichmentAgentConfig | undefined {
  return registry.get(type);
}

export function listEnrichmentAgents(): Array<{ type: string; config: EnrichmentAgentConfig }> {
  return Array.from(registry.entries()).map(([type, config]) => ({ type, config }));
}

// Register built-in agents
registerEnrichmentAgent('domain', {
  name: 'Domain Finder',
  description: 'Find or correct missing/placeholder domains via web search',
  handler: findDomain,
  defaultFilter: { missingField: 'domain' },
});

registerEnrichmentAgent('standardize_industry', {
  name: 'Industry Standardizer',
  description: 'Standardize industry names to a canonical set via web search',
  handler: standardizeIndustry,
});
