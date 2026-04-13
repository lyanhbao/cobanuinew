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
  Swords,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
  { label: 'Rankings', href: '/dashboard/rankings', icon: BarChart3 },
  { label: 'Channel', href: '/dashboard/channel', icon: BarChart3 },
  { label: 'Content', href: '/dashboard/content', icon: BarChart3 },
  { label: 'Benchmark', href: '/dashboard/benchmark', icon: BarChart3 },
  { label: 'Trends', href: '/dashboard/trends', icon: BarChart3 },
  { label: 'Battle Mode', href: '/dashboard/battle', icon: Swords },
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
    <aside className="w-64 flex flex-col glass-nav">
      <Link href="/" className="px-6 py-5 border-b border-white/6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill">
          <h1 className="text-xl font-display tracking-tight gradient-text">COBAN</h1>
        </div>
        <p className="text-xs text-white/40 mt-2 px-3">Intelligence Platform</p>
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
                'nav-item',
                isActive && 'nav-item-active'
              )}
            >
              {isActive && <span className="nav-active-bar" />}
              <Icon className="w-5 h-5 transition-transform duration-200" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-semibold text-white/30 uppercase tracking-wider">
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
                'nav-item',
                isActive && 'nav-item-active'
              )}
            >
              {isActive && <span className="nav-active-bar" />}
              <Icon className="w-5 h-5 transition-transform duration-200" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/6">
        <div className="p-3 rounded-xl glass-pill hover:glass-pill-active transition-all duration-300">
          <p className="text-xs text-white/40">Logged in as</p>
          <p className="text-sm font-medium text-white/70 truncate mt-0.5">{user?.email ?? '—'}</p>
        </div>
      </div>

      <style jsx>{`
        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.45);
          transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          overflow: hidden;
        }
        .nav-item:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(59, 130, 246, 0.06);
          transform: translateX(2px);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.08);
        }
        .nav-item-active {
          color: rgba(255, 255, 255, 0.95);
          background: rgba(59, 130, 246, 0.12);
          font-weight: 600;
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.12);
        }
        .nav-active-bar {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          border-radius: 0 2px 2px 0;
          background: rgba(59, 130, 246, 0.9);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
        }
      `}</style>
    </aside>
  );
}
