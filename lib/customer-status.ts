export const CUSTOMER_STATUS_VALUES = ['auth0_customer', 'okta_customer', 'common_customer'] as const;

export type CustomerStatus = typeof CUSTOMER_STATUS_VALUES[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  auth0_customer: 'Auth0 Customer',
  okta_customer: 'Okta Customer',
  common_customer: 'Common Customer',
};

export const CUSTOMER_STATUS_FILTER_OPTIONS = [
  { value: 'auth0_customer', label: CUSTOMER_STATUS_LABELS.auth0_customer },
  { value: 'okta_customer', label: CUSTOMER_STATUS_LABELS.okta_customer },
  { value: 'common_customer', label: CUSTOMER_STATUS_LABELS.common_customer },
] as const;

export function normalizeCustomerStatus(value: string | null | undefined): CustomerStatus | null {
  if (!value) return null;

  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!compact) return null;

  if (compact === 'auth0customer') return 'auth0_customer';
  if (compact === 'oktacustomer') return 'okta_customer';
  if (compact === 'commoncustomer') return 'common_customer';

  return null;
}

export function customerStatusLabel(value: CustomerStatus | null | undefined): string | null {
  if (!value) return null;
  return CUSTOMER_STATUS_LABELS[value] || null;
}
