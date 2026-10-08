import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, ViewStyle } from 'react-native';

import { ColorPalette, radius } from '@theme';
import { animation } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

const MIN_OPACITY = 0.4;
const MAX_OPACITY = 1;
// Web has no native animation driver — RN falls back to JS either way, but
// requesting the native driver there logs a console warning on every mount.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function Skeleton({ width, height, borderRadius = radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [opacity] = useState(() => new Animated.Value(MIN_OPACITY));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: animation.slow,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: animation.slow,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius, opacity }, style]}
    />
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surfaceElevated,
    },
  });
