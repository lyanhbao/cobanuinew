'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import DashboardSidebar from '@/components/dashboard/sidebar';
import DashboardHeader from '@/components/dashboard/header';
import DashboardFilterBar from '@/components/dashboard/filter-bar';
import type { Group, WeekStart } from '@/lib/types';
import { toWeekStart } from '@/lib/types';

function useDashboardBootstrap() {
  const { setClientId, setGroupId, setSelectedWeek, clientId, groupId, isReady, setAvailableWeeks, setReady } = useApp();
  const { fetchWithAuth, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  const clientIdRef = useRef<string | null>(clientId);
  const groupIdRef = useRef<string | null>(groupId);
  clientIdRef.current = clientId;
  groupIdRef.current = groupId;

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

  useEffect(() => {
    if (!isAuthenticated || !clientId) return;
    const currentClientId = clientIdRef.current;
    if (!currentClientId) return;

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
            setAvailableWeeks(weeks);
            const latestWeek = weeks[weeks.length - 1]!;
            setSelectedWeek(latestWeek);
            groupIdRef.current = latestWeek;
          }
        }
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, [isAuthenticated, clientId, fetchWithAuth, setGroupId, setAvailableWeeks, setSelectedWeek, setReady]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      setBootstrapLoading(false);
    }
  }, [isReady, isAuthenticated]);

  return { groups, bootstrapLoading };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { groups, bootstrapLoading } = useDashboardBootstrap();
  const mainRef = useRef<HTMLDivElement>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);

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

  if (authLoading || bootstrapLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 mx-auto w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="border-b border-border px-6 py-3 bg-card transition-all duration-500"
          style={headerScrolled ? { backdropFilter: 'blur(8px)' } : {}}
        >
          <DashboardHeader groups={groups} />
        </div>
        <div className="border-b border-border px-6 py-2 bg-card">
          <DashboardFilterBar />
        </div>
        <main ref={mainRef} className="flex-1 overflow-auto bg-background">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
