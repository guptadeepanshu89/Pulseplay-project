import { Platform, ViewStyle } from 'react-native';

import { ColorPalette } from './colors';

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ShadowParams {
  color: string;
  offsetHeight: number;
  opacity: number;
  radius: number;
  elevation: number;
}

/**
 * react-native-web deprecated the shadow* style props in favor of CSS
 * boxShadow, so web and native need different (equivalent) style shapes.
 */
export function platformShadow({ color, offsetHeight, opacity, radius, elevation }: ShadowParams): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${offsetHeight}px ${radius}px ${hexToRgba(color, opacity)}` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetHeight },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation,
    },
  })!;
}

const CARD_SHADOW_OFFSET_HEIGHT = 8;
const CARD_SHADOW_OPACITY = 0.28;
const CARD_SHADOW_RADIUS = 18;
const CARD_ELEVATION = 4;

export function cardElevation(colors: ColorPalette, scheme: 'light' | 'dark'): ViewStyle {
  return platformShadow({
    color: scheme === 'dark' ? colors.accent : colors.black,
    offsetHeight: scheme === 'dark' ? 0 : CARD_SHADOW_OFFSET_HEIGHT,
    opacity: scheme === 'dark' ? 0.18 : CARD_SHADOW_OPACITY,
    radius: CARD_SHADOW_RADIUS,
    elevation: CARD_ELEVATION,
  });
}
