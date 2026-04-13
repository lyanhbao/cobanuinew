'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import DashboardSidebar from '@/components/dashboard/sidebar';
import DashboardHeader from '@/components/dashboard/header';
import DashboardFilterBar from '@/components/dashboard/filter-bar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
 * group, then signals that data fetching can proceed.
 *
 * The effect fires when both isAuthenticated AND clientId are stable (truthy).
 * React hooks run synchronously during render, so if clientId is set via
 * setClientId and then the dashboard navigates, the next render will have
 * clientId already set and isAuthenticated=true, so the effect fires.
 */
function useDashboardBootstrap() {
  const { setClientId, setGroupId, setSelectedWeek, clientId, groupId, isReady, setAvailableWeeks, setReady } = useApp();
  const { fetchWithAuth, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  // Keep refs so async callbacks always read current state
  const clientIdRef = useRef<string | null>(clientId);
  const groupIdRef = useRef<string | null>(groupId);
  clientIdRef.current = clientId;
  groupIdRef.current = groupId;

  // Hydrate clientId from localStorage once authenticated.
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

  // Bootstrap effect: fires when both isAuthenticated and clientId are truthy.
  // This handles the race where:
  //   1. Dashboard mounts with clientId=null, isAuthenticated=false
  //   2. Auth hydrates → isAuthenticated=true, clientId=null → skip (no clientId)
  //   3. select-client sets clientId → state updates → render with clientId truthy
  //   4. Effect fires → bootstrap proceeds
  useEffect(() => {
    if (!isAuthenticated || !clientId) return;

    const currentClientId = clientIdRef.current;
    if (!currentClientId) return;

    // Fetch groups
    fetchWithAuth(`/api/clients/${currentClientId}/groups`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const list: Group[] = d.data ?? [];
        setGroups(list);
        const currentGroupId = groupIdRef.current;
        if (list.length > 0 && !currentGroupId) {
          setGroupId(list[0]!.id);
        }
      })
      .catch(() => setGroups([]));

    // Fetch weeks (group-agnostic)
    fetchWithAuth('/api/dashboard/weeks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.minWeek) {
          const { minWeek, maxWeek } = d.data;
          const end = maxWeek ? new Date(maxWeek + 'T00:00:00Z') : new Date();
          const start = new Date(minWeek + 'T00:00:00Z');
          const weeks: WeekStart[] = [];
          const cur = new Date(start);
          while (cur <= end) {
            weeks.push(toWeekStart(cur));
            cur.setDate(cur.getDate() + 7);
          }
          if (weeks.length > 0) {
            // Always default to the LATEST week (last in array) so dashboard
            // always shows fresh data, not a sparse old week from localStorage.
            setAvailableWeeks(weeks);
            const latestWeek = weeks[weeks.length - 1]!;
            setSelectedWeek(latestWeek);
            groupIdRef.current = latestWeek; // ensure week aligns with group
          }
        }
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, [isAuthenticated, clientId, fetchWithAuth, setGroupId, setAvailableWeeks, setSelectedWeek, setReady]);

  // Track bootstrap completion
  useEffect(() => {
    if (isReady && isAuthenticated) {
      setBootstrapLoading(false);
    }
  }, [isReady, isAuthenticated]);

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