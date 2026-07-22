import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { appReducer, type AppAction } from '@/state/app-reducer';
import {
  createDefaultState,
  LEGACY_STORAGE_KEY,
  migrateLegacyState,
  migrateV3State,
  parseStoredState,
  STORAGE_KEY,
  V3_STORAGE_KEY,
} from '@/lib/study';
import type { AppStateV4 } from '@/lib/types';

interface AppStateContextValue {
  state: AppStateV4;
  dispatch: Dispatch<AppAction>;
  hydrated: boolean;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface ProviderState {
  data: AppStateV4;
  hydrated: boolean;
}

function providerReducer(current: ProviderState, action: AppAction): ProviderState {
  return {
    data: appReducer(current.data, action),
    hydrated: action.type === 'hydrate' ? true : current.hydrated,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(providerReducer, undefined, () => ({
    data: createDefaultState(),
    hydrated: false,
  }));

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const storedV3 = window.localStorage.getItem(V3_STORAGE_KEY);
    const nextState = stored
      ? parseStoredState(stored)
      : storedV3
        ? migrateV3State(storedV3)
        : migrateLegacyState(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    dispatch({ type: 'hydrate', state: nextState });
  }, []);

  useEffect(() => {
    if (!store.hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data));
    } catch {
      // Storage can be unavailable in private or quota-constrained browser contexts.
    }
  }, [store.data, store.hydrated]);

  return (
    <AppStateContext.Provider
      value={{ state: store.data, dispatch, hydrated: store.hydrated }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}
