'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ClientId, GroupId, WeekStart, WeekId } from '@/lib/types';
import { toWeekStart, isoWeekNumber } from '@/lib/types';

const STORAGE_KEY = 'coban_app_state';

interface AppState {
  clientId: ClientId | null;
  groupId: GroupId | null;
  selectedWeek: WeekStart | null;
  availableWeeks: WeekStart[];
  /** Set true once groups + weeks have been bootstrapped from the backend. */
  isReady: boolean;
}

interface AppContextValue extends AppState {
  setClientId: (id: ClientId | null) => void;
  setGroupId: (id: GroupId | null) => void;
  setSelectedWeek: (week: WeekStart | null) => void;
  setAvailableWeeks: (weeks: WeekStart[]) => void;
  setReady: (ready: boolean) => void;
  reset: () => void;
}

const defaultState: AppState = {
  clientId: null,
  groupId: null,
  selectedWeek: null,
  availableWeeks: [],
  isReady: false,
};

function buildDefaultState(): AppState {
  const weeks = generateAvailableWeeks();
  return {
    ...defaultState,
    availableWeeks: weeks,
    // Default to the most recent available week so dashboard shows data immediately
    selectedWeek: weeks.length > 0 ? weeks[weeks.length - 1]! : null,
  };
}

function generateAvailableWeeks(count = 104): WeekStart[] {
  const weeks: WeekStart[] = [];
  // Generate 104 weeks (~2 years) going back from today
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const earliest = new Date(end);
  earliest.setDate(earliest.getDate() - (count - 1) * 7);
  for (let i = 0; i < count; i++) {
    const d = new Date(earliest);
    d.setDate(d.getDate() + i * 7);
    weeks.push(toWeekStart(d));
  }
  return weeks;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === 'undefined') return buildDefaultState();
    const freshWeeks = generateAvailableWeeks();
    const defaultWeek = freshWeeks.length > 0 ? freshWeeks[freshWeeks.length - 1]! : null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppState>;
        // Validate selectedWeek is in the current weeks list; fall back to last week
        const storedWeek = parsed.selectedWeek;
        const validWeek = storedWeek && freshWeeks.includes(storedWeek) ? storedWeek : defaultWeek;
        return {
          ...defaultState,
          clientId: parsed.clientId ?? null,
          groupId: parsed.groupId ?? null,
          selectedWeek: validWeek,
          availableWeeks: freshWeeks,
        };
      }
    } catch {
      // ignore parse errors
    }
    return {
      ...defaultState,
      selectedWeek: defaultWeek,
      availableWeeks: freshWeeks,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clientId: state.clientId,
        groupId: state.groupId,
        selectedWeek: state.selectedWeek,
      }));
    } catch {
      // ignore storage errors
    }
  }, [state]);

  const setClientId = useCallback((id: ClientId | null) => {
    setState((s) => ({ ...s, clientId: id, groupId: null, isReady: false }));
  }, []);

  const setGroupId = useCallback((id: GroupId | null) => {
    setState((s) => ({ ...s, groupId: id }));
  }, []);

  const setSelectedWeek = useCallback((week: WeekStart | null) => {
    setState((s) => ({ ...s, selectedWeek: week }));
  }, []);

  const setAvailableWeeks = useCallback((weeks: WeekStart[]) => {
    setState((s) => ({ ...s, availableWeeks: weeks }));
  }, []);

  const setReady = useCallback((ready: boolean) => {
    setState((s) => ({ ...s, isReady: ready }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, clientId: null, groupId: null, selectedWeek: null, isReady: false }));
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setClientId, setGroupId, setSelectedWeek, setAvailableWeeks, setReady, reset }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function getWeekId(weekStart: WeekStart): WeekId {
  const date = new Date(weekStart + 'T00:00:00Z');
  return {
    weekStart,
    weekNumber: isoWeekNumber(date),
    year: date.getUTCFullYear(),
  };
}
