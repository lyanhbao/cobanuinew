'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  FolderOpen,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
  { label: 'Rankings', href: '/dashboard/rankings', icon: BarChart3 },
  { label: 'Schedule', href: '/dashboard/schedule', icon: CalendarDays },
  { label: 'Channel', href: '/dashboard/channel', icon: BarChart3 },
  { label: 'Content', href: '/dashboard/content', icon: BarChart3 },
  { label: 'Benchmark', href: '/dashboard/benchmark', icon: BarChart3 },
  { label: 'Trends', href: '/dashboard/trends', icon: BarChart3 },
];

const subNavItems = [
  { label: 'Groups', href: '/dashboard/groups', icon: FolderOpen },
  { label: 'Alerts', href: '/dashboard/alerts', icon: AlertCircle },
  { label: 'Team', href: '/dashboard/team', icon: Users },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="w-64 flex flex-col bg-card border-r border-border">
      <Link href="/" className="px-6 py-5 border-b border-border">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
          <h1 className="text-xl font-display tracking-tight">COBAN</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-3">Intelligence Platform</p>
      </Link>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground'
                  : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-2">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Management
          </p>
        </div>

        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground'
                  : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="p-3 rounded-lg bg-secondary">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="text-sm font-medium text-foreground truncate mt-0.5">{user?.email ?? '—'}</p>
        </div>
      </div>
    </aside>
  );
}
