'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import DashboardSidebar from '@/components/dashboard/sidebar';
import DashboardHeader from '@/components/dashboard/header';
import DashboardFilterBar from '@/components/dashboard/filter-bar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { Group, WeekStart } from '@/lib/types';
import { toWeekStart } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Overview', value: 'overview', href: '/dashboard/overview' },
  { label: 'Rankings', value: 'rankings', href: '/dashboard/rankings' },
  { label: 'Channel', value: 'channel', href: '/dashboard/channel' },
  { label: 'Content', value: 'content', href: '/dashboard/content' },
  { label: 'Benchmark', value: 'benchmark', href: '/dashboard/benchmark' },
  { label: 'Trends', value: 'trends', href: '/dashboard/trends' },
];

/**
 * Bootstraps the dashboard: loads client → groups, auto-selects the first
 * group, then passes everything to AppContext before rendering pages.
 * This ensures groupId is available BEFORE any page component mounts and
 * fires its data-fetching useEffect.
 */
function useDashboardBootstrap() {
  const { setClientId, setGroupId, setSelectedWeek, clientId, groupId, availableWeeks, setAvailableWeeks, setReady } = useApp();
  const { fetchWithAuth, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  // Set clientId from localStorage once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (clientId) return;
    const stored = localStorage.getItem('coban_app_state');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.clientId) setClientId(parsed.clientId);
      } catch {
        // ignore
      }
    }
  }, [isAuthenticated, clientId, setClientId]);

  // Fetch groups when clientId is available, auto-select first
  useEffect(() => {
    if (!clientId) return;
    fetchWithAuth(`/api/clients/${clientId}/groups`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const list: Group[] = d.data ?? [];
        setGroups(list);
        if (list.length > 0 && !groupId) {
          setGroupId(list[0]!.id);
        }
      })
      .catch(() => setGroups([]));
  }, [clientId, groupId, setGroupId, fetchWithAuth]);

  // Fetch real week range from backend and update AppContext.
  // Runs only after groupId is set (groups effect has completed setGroupId).
  // This ordering guarantees groupId is stable before useDashboardData fires.
  useEffect(() => {
    if (!clientId || !isAuthenticated) return;
    if (!groupId) return; // wait for group to be auto-selected first
    fetchWithAuth('/api/dashboard/weeks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.data?.minWeek) return;
        const { minWeek, maxWeek } = d.data;
        // Generate weeks from minWeek to maxWeek (or now if maxWeek is null)
        const end = maxWeek ? new Date(maxWeek + 'T00:00:00Z') : new Date();
        const start = new Date(minWeek + 'T00:00:00Z');
        const weeks: WeekStart[] = [];
        const cur = new Date(start);
        while (cur <= end) {
          weeks.push(toWeekStart(cur));
          cur.setDate(cur.getDate() + 7);
        }
        if (weeks.length > 0) {
          setAvailableWeeks(weeks);
          // Default to latest week (last in array)
          setSelectedWeek(weeks[weeks.length - 1]!);
        }
        // Signal that bootstrap is complete — this unblocks useDashboardData hooks
        setReady(true);
      })
      .catch(() => {});
  }, [clientId, isAuthenticated, groupId, fetchWithAuth, setAvailableWeeks, setSelectedWeek, setReady]);

  // Track bootstrap completion to hide the loading spinner
  useEffect(() => {
    if (groups.length > 0 && isAuthenticated) {
      setBootstrapLoading(false);
    }
  }, [groups, isAuthenticated]);

  return { groups, bootstrapLoading };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { groups, bootstrapLoading } = useDashboardBootstrap();
  const mainRef = useRef<HTMLDivElement>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const activeTab =
    TABS.find((t) => pathname.startsWith(t.href))?.value ?? 'overview';

  // Header shrink/blur on scroll
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onScroll = () => {
      setHeaderScrolled(main.scrollTop > 8);
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleTabChange = (value: string) => {
    const tab = TABS.find((t) => t.value === value);
    if (tab) router.push(tab.href);
  };

  if (authLoading || bootstrapLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 mx-auto w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — persistent across navigations, isolate from page transitions */}
      <div style={{ viewTransitionName: 'persistent-sidebar' }}>
        <DashboardSidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — persistent, shrinks on scroll */}
        <div
          style={{ viewTransitionName: 'persistent-header' }}
          className={cn(
            'border-b transition-all duration-500',
            headerScrolled
              ? 'bg-background/80 backdrop-blur-md py-1 shadow-sm'
              : 'bg-card py-3',
          )}
        >
          <DashboardHeader groups={groups} />
        </div>

        {/* Filter bar — date range, time range, platform/brand filters */}
        <div
          className={cn(
            'border-b border-border px-6 transition-all duration-500',
            headerScrolled ? 'py-1.5 bg-background/80 backdrop-blur-md' : 'py-2 bg-card',
          )}
        >
          <div style={{ viewTransitionName: 'persistent-filter-bar' }}>
            <DashboardFilterBar />
          </div>
        </div>

        <div className="border-b border-border transition-all duration-500 bg-card px-6">
          {/* Tab bar — persistent, isolate */}
          <div style={{ viewTransitionName: 'persistent-tabs' }}>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-11 bg-transparent border-b-0 p-0 gap-0">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-11 px-4 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent data-[state=active]:bg-transparent"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
        <main ref={mainRef} className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}