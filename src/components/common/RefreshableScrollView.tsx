import { PropsWithChildren, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, ScrollViewProps } from 'react-native';

import { useTheme } from '@context/ThemeContext';

interface RefreshableScrollViewProps extends PropsWithChildren {
  onRefresh: () => Promise<void>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

export function RefreshableScrollView({ onRefresh, contentContainerStyle, children }: RefreshableScrollViewProps) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    >
      {children}
    </ScrollView>
  );
}
