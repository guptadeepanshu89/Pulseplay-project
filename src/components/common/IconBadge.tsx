import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { radius } from '@theme';
import { useTheme } from '@context/ThemeContext';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface IconBadgeProps {
  icon: IoniconName;
  size?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  bordered?: boolean;
  style?: ViewStyle;
}

const DEFAULT_SIZE = 40;
const ICON_SIZE_RATIO = 0.5;

export function IconBadge({
  icon,
  size = DEFAULT_SIZE,
  iconSize,
  color,
  backgroundColor,
  borderRadius = radius.full,
  bordered = false,
  style,
}: IconBadgeProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const resolvedBackground = backgroundColor ?? colors.accentMuted;
  const resolvedIconSize = iconSize ?? Math.round(size * ICON_SIZE_RATIO);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: resolvedBackground,
        },
        bordered && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <Ionicons name={icon} size={resolvedIconSize} color={resolvedColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
