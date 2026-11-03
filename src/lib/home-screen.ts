import { useSyncExternalStore } from 'react';

/** What 加入主畫面 does here: the system's install dialog, or which written steps to show. */
export type HomeScreenMode = 'prompt' | HomeScreenGuideMode;
export type HomeScreenGuideMode = 'ios' | 'android' | 'ios-in-app' | 'android-in-app';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

let installPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Listens at module load, not in a component: Chrome can fire this before React starts.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Otherwise Chrome shows its own install bar, which can cover a question.
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installed = true;
    notify();
  });
}

/** iPadOS reports itself as a Mac, and only its touch points give it away. */
function isIosDevice(userAgent: string, maxTouchPoints: number) {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

export function deviceHomeScreenMode(
  userAgent: string,
  maxTouchPoints: number,
): HomeScreenGuideMode | null {
  if (isIosDevice(userAgent, maxTouchPoints))
    return /Safari\//.test(userAgent) ? 'ios' : 'ios-in-app';
  if (/Android/.test(userAgent))
    return /; wv\)/.test(userAgent) ? 'android-in-app' : 'android';
  return null;
}

function navigatorStandalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function runningAsApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigatorStandalone();
}

function currentMode(): HomeScreenMode | null {
  const mode = deviceHomeScreenMode(navigator.userAgent, navigator.maxTouchPoints);
  if (!mode || installed || runningAsApp()) return null;
  return installPrompt ? 'prompt' : mode;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHomeScreenMode() {
  return useSyncExternalStore(subscribe, currentMode, () => null);
}

export function showInstallPrompt() {
  installPrompt?.prompt().catch(() => {});
  // Chrome allows one prompt per event; after it the button falls back to the written steps.
  installPrompt = null;
  notify();
}
