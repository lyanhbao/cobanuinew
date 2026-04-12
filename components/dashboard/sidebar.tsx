'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
  { label: 'Rankings', href: '/dashboard/rankings', icon: BarChart3 },
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
    <aside className="w-64 border-r border-border bg-card flex flex-col sidebar-gradient">
      <Link href="/" className="px-6 py-6 border-b border-border">
        <h1 className="text-2xl font-display tracking-tight gradient-text">COBAN</h1>
        <p className="text-xs text-muted-foreground mt-1">Intelligence Platform</p>
      </Link>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-[#1a358b] text-white shadow-sm font-semibold'
                  : 'text-foreground/60 hover:text-[#1a358b] hover:bg-[#1a358b]/10 hover:translate-x-0.5'
              )}
            >
              <Icon className="w-5 h-5 transition-transform duration-200" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-[#1a358b] text-white shadow-sm font-semibold'
                  : 'text-foreground/60 hover:text-[#1a358b] hover:bg-[#1a358b]/10 hover:translate-x-0.5'
              )}
            >
              <Icon className="w-5 h-5 transition-transform duration-200" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="p-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors duration-200">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="text-sm font-medium truncate">{user?.email ?? '—'}</p>
        </div>
      </div>
    </aside>
  );
}
