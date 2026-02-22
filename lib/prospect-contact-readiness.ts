export type ContactReadiness = 'dial_ready' | 'email_ready' | 'social_ready' | 'incomplete';

export function assessContactReadiness(prospect: {
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  do_not_call?: number | null;
}): ContactReadiness {
  const hasDialable = !!(prospect.phone || prospect.mobile);
  const notDNC = !prospect.do_not_call;
  if (hasDialable && notDNC) return 'dial_ready';
  if (prospect.email) return 'email_ready';
  if (prospect.linkedin_url) return 'social_ready';
  return 'incomplete';
}
