'use client';

import { useCallback } from 'react';

export function useTds() {
  const getTdsPercentage = useCallback((category: string): number => {
    if (category === 'contractor' || category === 'mobilization') return 2;
    return 0;
  }, []);

  return { getTdsPercentage };
}
