import type { ComponentType } from 'react';
import {
  Briefcase,
  Building,
  Building2,
  Database,
  Download,
  FlaskConical,
  FolderSync,
  Gauge,
  Mail,
  MapPinned,
  Network,
  Search,
  Sheet,
  Upload,
  Users,
  Activity,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  activePath?: string;
  icon: ComponentType<{ className?: string }>;
}

export const primaryLinks: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/prospects', label: 'Prospects', icon: Users },
  { href: '/opportunities', label: 'Opportunities', icon: Briefcase },
  { href: '/triage', label: 'Triage', icon: Search },
];

export const toolLinks: NavItem[] = [
  { href: '/spreadsheet', label: 'Spreadsheet', icon: Sheet },
  { href: '/accounts/map', label: 'Account Map', activePath: '/accounts/map', icon: MapPinned },
  { href: '/email-writer', label: 'Email Writer', icon: Mail },
  { href: '/org-chart', label: 'Org Chart', icon: Network },
  { href: '/quick-research', label: 'Quick Research', icon: Search },
  { href: '/upload', label: 'Upload CSV', icon: Upload },
  { href: '/customer-status-upload', label: 'Customer Status Upload', icon: Upload },
  { href: '/import-opportunities', label: 'Import Opportunities', icon: Download },
  { href: '/import-activities', label: 'Import Activities', icon: Activity },
  { href: '/ql-import', label: 'Bulk HVT Writing', icon: Database },
  { href: '/employee-counts/jobs', label: 'Employee Counts', activePath: '/employee-counts', icon: Users },
  { href: '/summarize-activities', label: 'Summarize Activities', icon: FolderSync },
  { href: '/parent-company', label: 'Parent Company Finder', icon: Building },
  { href: '/hq-state', label: 'HQ State Assignment', activePath: '/hq-state', icon: MapPinned },
  { href: '/test', label: 'System Diagnostics', icon: FlaskConical },
];
