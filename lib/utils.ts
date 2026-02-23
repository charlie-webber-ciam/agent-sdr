export function formatDomain(domain: string | null | undefined): string {
  if (!domain || domain.includes('.placeholder')) return 'No domain';
  return domain;
}
