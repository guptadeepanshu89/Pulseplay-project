import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { radius } from '@theme';
import { useTheme } from '@context/ThemeContext';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface IconButtonProps {
  name: IoniconName;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  accessibilityLabel?: string;
}

const DEFAULT_ICON_SIZE = 20;
const HIT_SLOP = 8;
const BUTTON_SIZE = 36;

export function IconButton({
  name,
  onPress,
  size = DEFAULT_ICON_SIZE,
  color,
  backgroundColor = 'transparent',
  accessibilityLabel,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
