import { useEffect } from 'react';

export function useLoadOnMount(loadFn: () => Promise<void>): void {
  useEffect(() => {
    loadFn();
  }, [loadFn]);
}
