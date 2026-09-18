'use client';

import { useEffect, useState } from 'react';

/**
 * useMediaQuery — media query reactiva, segura para SSR (false en servidor).
 * @example const isMobile = useMediaQuery('(max-width: 860px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
