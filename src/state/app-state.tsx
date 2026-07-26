import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { appReducer, type AppAction } from '@/state/app-reducer';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import type { StorageWriteResult } from '@/lib/storage';
import { createDefaultState, parseStoredState, STORAGE_KEY } from '@/lib/study';
import type { AppState } from '@/lib/types';

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  hydrated: boolean;
  /** Set when the browser refused the last save, so the UI can warn the user. */
  persistence: StorageWriteResult;
  reportPersistence: (source: string, result: StorageWriteResult) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface ProviderState {
  data: AppState;
  hydrated: boolean;
  persistenceBySource: Record<string, StorageWriteResult>;
}

type ProviderAction =
  | AppAction
  | {
      type: 'persistence-result';
      source: string;
      result: StorageWriteResult;
    };

function providerReducer(current: ProviderState, action: ProviderAction): ProviderState {
  if (action.type === 'persistence-result') {
    return current.persistenceBySource[action.source] === action.result
      ? current
      : {
          ...current,
          persistenceBySource: {
            ...current.persistenceBySource,
            [action.source]: action.result,
          },
        };
  }
  return {
    ...current,
    data: appReducer(current.data, action),
    hydrated: action.type === 'hydrate' ? true : current.hydrated,
  };
}

function aggregatePersistence(
  persistenceBySource: Record<string, StorageWriteResult>,
): StorageWriteResult {
  const results = Object.values(persistenceBySource);
  if (results.includes('unavailable')) return 'unavailable';
  if (results.includes('quota-exceeded')) return 'quota-exceeded';
  return 'saved';
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(providerReducer, undefined, () => ({
    data: createDefaultState(),
    hydrated: false,
    persistenceBySource: {
      'app-state': 'saved' as StorageWriteResult,
    },
  }));
  const reportPersistence = useCallback(
    (source: string, result: StorageWriteResult) => {
      dispatch({ type: 'persistence-result', source, result });
    },
    [],
  );

  useEffect(() => {
    dispatch({
      type: 'hydrate',
      state: parseStoredState(readStoredValue(STORAGE_KEY)),
    });
  }, []);

  useEffect(() => {
    if (!store.hydrated) return;
    dispatch({
      type: 'persistence-result',
      source: 'app-state',
      result: writeStoredValue(STORAGE_KEY, JSON.stringify(store.data)),
    });
  }, [store.data, store.hydrated]);

  return (
    <AppStateContext.Provider
      value={{
        state: store.data,
        dispatch: dispatch as Dispatch<AppAction>,
        hydrated: store.hydrated,
        persistence: aggregatePersistence(store.persistenceBySource),
        reportPersistence,
      }}
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
