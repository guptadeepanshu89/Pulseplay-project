import { Image, StyleSheet, View } from 'react-native';

import { ColorPalette, radius } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
}

const DEFAULT_SIZE = 40;

export function Avatar({ name, imageUrl, size = DEFAULT_SIZE }: AvatarProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const dimensionStyle = { width: size, height: size, borderRadius: radius.full };

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={dimensionStyle} />;
  }

  return (
    <View style={[styles.fallback, dimensionStyle]}>
      <AppText variant="bodySemibold" color={colors.accent}>
        {initials}
      </AppText>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    fallback: {
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
