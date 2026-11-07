export const PROGRESS_CHANGED_EVENT = 'shaneweb:progress-changed';
export const REMOTE_PROGRESS_URL = 'shaneweb:remote-progress';
export function notifyProgressChanged(key: string) {
  if (typeof window !== 'undefined' && ['shaneweb:practice-session', 'shaneweb:quiz-progress'].includes(key)) {
    window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));
  }
}
