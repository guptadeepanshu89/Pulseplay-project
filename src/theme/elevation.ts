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

const CARD_SHADOW_OFFSET_HEIGHT = 4;
const CARD_SHADOW_OPACITY = 0.06;
const CARD_SHADOW_RADIUS = 12;
const CARD_ELEVATION = 2;

/**
 * Dark surfaces already read as elevated via lightness contrast against the
 * near-black background, so a drop shadow adds little there and is skipped.
 * Light surfaces are close in lightness to the page background, so a soft
 * shadow is what actually reads as "elevated" instead of just "outlined".
 */
export function cardElevation(colors: ColorPalette, scheme: 'light' | 'dark'): ViewStyle {
  if (scheme !== 'light') return {};
  return platformShadow({
    color: colors.black,
    offsetHeight: CARD_SHADOW_OFFSET_HEIGHT,
    opacity: CARD_SHADOW_OPACITY,
    radius: CARD_SHADOW_RADIUS,
    elevation: CARD_ELEVATION,
  });
}
