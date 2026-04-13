'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { weekLabel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
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
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-secondary/50 border-border hover:bg-accent transition-colors"
            >
              <span className="font-medium truncate max-w-[200px]">
                {selectedGroup?.name ?? 'Select Group'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover border-border">
            {groups.length === 0 ? (
              <DropdownMenuItem disabled>
                No groups found
              </DropdownMenuItem>
            ) : (
              groups.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onSelect={() => handleGroupChange(g.id)}
                  className={cn(
                    'cursor-pointer',
                    g.id === groupId
                      ? 'font-medium bg-accent'
                      : 'hover:bg-accent'
                  )}
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
          <SelectTrigger className="w-[280px] bg-secondary/50 border-border [&>span]:text-foreground">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {availableWeeks.slice(0, 12).map((week) => {
              return (
                <SelectItem key={week} value={week}>
                  {weekLabel(week)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 bg-secondary/50 border-border"
            >
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="hidden md:inline text-sm max-w-[150px] truncate">
                {user?.email}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
            <DropdownMenuItem
              onSelect={() => router.push('/dashboard/settings')}
              className="cursor-pointer hover:bg-accent"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleSignOut}
              className="cursor-pointer text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
