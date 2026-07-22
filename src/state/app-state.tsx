'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import { appReducer, type AppAction } from '@/state/app-reducer';
import { createDefaultState, parseStoredState, STORAGE_KEY } from '@/lib/study';
import type { AppStateV2 } from '@/lib/types';

interface AppStateContextValue {
  state: AppStateV2;
  dispatch: Dispatch<AppAction>;
  hydrated: boolean;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function applyPreferences(state: AppStateV2) {
  const root = document.documentElement;
  root.dataset.theme = state.preferences.theme;
  root.dataset.fontScale = state.preferences.fontScale;
  root.dataset.sidebar = state.preferences.sidebarCollapsed ? 'collapsed' : 'expanded';
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createDefaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedState = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
    dispatch({ type: 'hydrate', state: storedState });
    applyPreferences(storedState);
    // Hydration is the one intentional state sync from the browser storage boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyPreferences(state);
  }, [hydrated, state]);

  return (
    <AppStateContext.Provider value={{ state, dispatch, hydrated }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}
