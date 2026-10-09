import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@theme';

interface HorizontalCardRowProps extends PropsWithChildren {
  /** Optional fixed row height (e.g. EventCard). Omit to size to content. */
  cardHeight?: number;
}

export function HorizontalCardRow({ cardHeight, children }: HorizontalCardRowProps) {
  return (
    <View style={[styles.row, cardHeight !== undefined ? { height: cardHeight } : undefined]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        style={styles.scroll}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexShrink: 0,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  scroll: {
    overflow: 'visible',
  },
  container: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
});
