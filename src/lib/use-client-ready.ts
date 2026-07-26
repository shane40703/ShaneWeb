import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns false for server rendering and the first hydration pass, then true
 * on the client. This keeps router-dependent UI hydration-safe without a
 * set-state effect.
 */
export function useClientReady() {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
