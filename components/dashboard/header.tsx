'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp, getWeekId } from '@/context/AppContext';
import { weekLabel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
import type { Group } from '@/lib/types';

interface DashboardHeaderProps {
  /** Groups passed from layout after bootstrap fetch — avoids double-fetch */
  groups: Group[];
}

export default function DashboardHeader({ groups }: DashboardHeaderProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { groupId, setGroupId, selectedWeek, setSelectedWeek, availableWeeks } = useApp();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleGroupChange = (id: string) => {
    setGroupId(id);
    router.push('/dashboard/overview');
  };

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
  };

  const selectedGroup = groups.find((g) => g.id === groupId);

  return (
    <header className="px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Group selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="font-medium truncate max-w-[200px]">
                {selectedGroup?.name ?? 'Select Group'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {groups.length === 0 ? (
              <DropdownMenuItem disabled>No groups found</DropdownMenuItem>
            ) : (
              groups.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onSelect={() => handleGroupChange(g.id)}
                  className={g.id === groupId ? 'font-medium' : ''}
                >
                  {g.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Week selector */}
        <Select
          value={selectedWeek ?? undefined}
          onValueChange={handleWeekChange}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {availableWeeks.slice(0, 12).map((week) => {
              return (
                <SelectItem key={week} value={week}>
                  {weekLabel(week)}
                </SelectItem>
              );
            })}
            {availableWeeks.length > 12 && (
              <DropdownMenuSeparator />
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden md:inline text-sm max-w-[150px] truncate">
                {user?.email}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
