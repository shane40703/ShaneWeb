import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useReducer,
} from 'react';
import { appReducer, type AppAction } from '@/state/app-reducer';
import {
  readStoredNoteImages,
  stateWithoutNoteImages,
  writeStoredNoteImages,
} from '@/lib/note-image-storage';
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
  noteImagesHydrated: boolean;
  persistenceBySource: Record<string, StorageWriteResult>;
}

type ProviderAction =
  | AppAction
  | {
      type: 'persistence-result';
      source: string;
      result: StorageWriteResult;
    }
  | {
      type: 'note-images-hydrated';
      noteImages: AppState['noteImages'];
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
  if (action.type === 'note-images-hydrated') {
    return {
      ...current,
      data: {
        ...current.data,
        noteImages: { ...action.noteImages, ...current.data.noteImages },
      },
      noteImagesHydrated: true,
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
  const saveSequence = useRef(0);
  const [store, dispatch] = useReducer(providerReducer, undefined, () => ({
    data: createDefaultState(),
    hydrated: false,
    noteImagesHydrated: false,
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
    let cancelled = false;
    const localState = parseStoredState(readStoredValue(STORAGE_KEY));
    dispatch({ type: 'hydrate', state: localState });
    void readStoredNoteImages()
      .then(async (storedImages) => {
        const indexedImages = storedImages === null
          ? null
          : parseStoredState(JSON.stringify({ noteImages: storedImages })).noteImages;
        if (storedImages === null && Object.keys(localState.noteImages).length) {
          await writeStoredNoteImages(localState.noteImages);
        }
        if (!cancelled) {
          dispatch({
            type: 'note-images-hydrated',
            noteImages: indexedImages ?? localState.noteImages,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({
            type: 'note-images-hydrated',
            noteImages: localState.noteImages,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!store.hydrated || !store.noteImagesHydrated) return;
    const sequence = ++saveSequence.current;
    void writeStoredNoteImages(store.data.noteImages)
      .then(() => writeStoredValue(
        STORAGE_KEY,
        JSON.stringify(stateWithoutNoteImages(store.data)),
      ))
      .catch(() => writeStoredValue(STORAGE_KEY, JSON.stringify(store.data)))
      .then((result) => {
        if (sequence === saveSequence.current) {
          dispatch({ type: 'persistence-result', source: 'app-state', result });
        }
      });
  }, [store.data, store.hydrated, store.noteImagesHydrated]);

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
