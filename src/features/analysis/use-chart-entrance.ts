import { useEffect, useState } from 'react';

/** Animate once when the chart reaches the viewport; leave the chart visible without JS. */
export function useChartEntrance<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!element || entered || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, entered]);

  return [setElement, entered] as const;
}
