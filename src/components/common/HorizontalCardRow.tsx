import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@theme';

interface HorizontalCardRowProps extends PropsWithChildren {
  cardHeight: number;
}

export function HorizontalCardRow({ cardHeight, children }: HorizontalCardRowProps) {
  return (
    <View style={[styles.row, { height: cardHeight }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexShrink: 0,
    marginBottom: spacing.xl,
  },
  container: {
    gap: spacing.md,
  },
});
