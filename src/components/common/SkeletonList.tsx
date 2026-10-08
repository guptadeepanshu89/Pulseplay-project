import { spacing } from '@theme';

import { Skeleton } from './Skeleton';

interface SkeletonListProps {
  count: number;
  itemHeight: number;
  gap?: number;
}

export function SkeletonList({ count, itemHeight, gap = spacing.sm }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} width="100%" height={itemHeight} style={{ marginBottom: gap }} />
      ))}
    </>
  );
}
