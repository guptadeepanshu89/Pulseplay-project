import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

const PRESSED_OPACITY = 0.85;

interface TouchableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

/**
 * Drop-in Pressable that always gives tactile opacity feedback on press —
 * plain Pressable gives none by default, which is why so many rows/buttons
 * in this app felt unresponsive until this existed.
 */
export function Touchable({ style, disabled, ...rest }: TouchableProps) {
  return (
    <Pressable
      disabled={disabled}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && !disabled ? { opacity: PRESSED_OPACITY } : null,
      ]}
      {...rest}
    />
  );
}
