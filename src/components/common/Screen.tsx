import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { ColorPalette } from '@theme';
import { useTheme } from '@context/ThemeContext';

interface ScreenProps extends PropsWithChildren {
  edges?: Edge[];
  style?: ViewStyle;
  scrollable?: boolean;
}

const DEFAULT_EDGES: Edge[] = ['top', 'left', 'right'];

export function Screen({ children, edges = DEFAULT_EDGES, style }: ScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
  });
