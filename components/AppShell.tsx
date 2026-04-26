'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import { primaryLinks, toolLinks } from '@/lib/nav-links';
import type { NavItem } from '@/lib/nav-links';
import { usePerspective, OktaPatch } from '@/lib/perspective-context';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CommandPalette from '@/components/CommandPalette';

const PATCH_OPTIONS: { value: OktaPatch; label: string; shortLabel: string }[] = [
  { value: 'emerging', label: 'Emerging', shortLabel: 'EM' },
  { value: 'crp', label: 'Corporate', shortLabel: 'CO' },
  { value: 'ent', label: 'Enterprise', shortLabel: 'EN' },
  { value: 'stg', label: 'Strategic', shortLabel: 'ST' },
  { value: 'pubsec', label: 'Public Sector', shortLabel: 'PS' },
];

function PerspectiveControls({
  collapsed,
  perspective,
  setPerspective,
  oktaPatch,
  setOktaPatch,
}: {
  collapsed: boolean;
  perspective: 'auth0' | 'okta';
  setPerspective: (value: 'auth0' | 'okta') => void;
  oktaPatch: OktaPatch;
  setOktaPatch: (value: OktaPatch) => void;
}) {
  return (
    <div className="space-y-3">
      {!collapsed && (
        <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Research perspective</p>
      )}
      <TooltipProvider delayDuration={300}>
        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={perspective === 'auth0' ? 'default' : 'outline'}
                size={collapsed ? 'icon' : 'sm'}
                onClick={() => setPerspective('auth0')}
                className={cn(collapsed && 'mx-auto')}
              >
                <span className="font-semibold">A</span>
                {!collapsed && <span>Auth0</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Auth0 CIAM: Customer identity research</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={perspective === 'okta' ? 'default' : 'outline'}
                size={collapsed ? 'icon' : 'sm'}
                onClick={() => setPerspective('okta')}
                className={cn(collapsed && 'mx-auto')}
              >
                <span className="font-semibold">O</span>
                {!collapsed && <span>Okta</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Okta Workforce: Employee identity research</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {perspective === 'okta' && (
        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          {PATCH_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={oktaPatch === option.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setOktaPatch(option.value)}
              className={cn('justify-start', collapsed && 'justify-center px-0')}
            >
              {collapsed ? option.shortLabel : option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavSection({
  title,
  items,
  collapsed,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <div className="space-y-1">
      {!collapsed && <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.activePath ?? item.href);
        return (
          <Button
            key={item.href}
            asChild
            variant={active ? 'secondary' : 'ghost'}
            className={cn('w-full justify-start gap-2', collapsed && 'justify-center px-0')}
            onClick={onNavigate}
          >
            <Link href={item.href} title={collapsed ? item.label : undefined}>
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

function MobileSidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const { perspective, setPerspective, oktaPatch, setOktaPatch } = usePerspective();

  return (
    <div className="space-y-6">
      <PerspectiveControls
        collapsed={false}
        perspective={perspective}
        setPerspective={setPerspective}
        oktaPatch={oktaPatch}
        setOktaPatch={setOktaPatch}
      />
      <Separator />
      <NavSection title="Primary" items={primaryLinks} collapsed={false} pathname={pathname} onNavigate={onNavigate} />
      <Separator />
      <NavSection title="Tools" items={toolLinks} collapsed={false} pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { perspective, setPerspective, oktaPatch, setOktaPatch } = usePerspective();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentTitle = useMemo(() => {
    const allLinks = [...primaryLinks, ...toolLinks];
    const match = allLinks.find((link) => {
      const path = link.activePath ?? link.href;
      if (path === '/') return pathname === '/';
      return pathname.startsWith(path);
    });
    return match?.label ?? 'Dashboard';
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'hidden border-r border-border bg-card transition-all duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col',
            collapsed ? 'md:w-[90px]' : 'md:w-72'
          )}
        >
          <div className={cn('flex p-4 pb-2', collapsed ? 'justify-center' : 'justify-end')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(collapsed && 'hidden')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
            {collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="mx-auto"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Expand sidebar</span>
              </Button>
            )}
          </div>

          <div className="space-y-4 px-4 pb-4">
            <PerspectiveControls
              collapsed={collapsed}
              perspective={perspective}
              setPerspective={setPerspective}
              oktaPatch={oktaPatch}
              setOktaPatch={setOktaPatch}
            />
          </div>

          <Separator />

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
            <NavSection title="Primary" items={primaryLinks} collapsed={collapsed} pathname={pathname} />
            <NavSection title="Tools" items={toolLinks} collapsed={collapsed} pathname={pathname} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[320px] overflow-y-auto p-5">
                  <SheetHeader className="mb-6">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <MobileSidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-sm font-semibold text-foreground">{currentTitle}</p>
                <p className="text-xs text-muted-foreground">{perspective === 'okta' ? 'Okta' : 'Auth0'} workspace</p>
              </div>
            </div>
          </header>

          <main className="w-full flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
