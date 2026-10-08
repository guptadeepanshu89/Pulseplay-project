import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ title, subtitle, onBack, right }: HeaderProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.container, subtitle ? styles.containerWithSubtitle : null]}>
      <View style={styles.side}>
        {onBack && <IconButton name="chevron-back" onPress={onBack} accessibilityLabel="Go back" />}
      </View>
      <View style={styles.titleGroup}>
        <AppText variant="h3" numberOfLines={1} align="center">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} align="center">
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      height: layout.headerHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    containerWithSubtitle: {
      height: layout.headerHeight + spacing.lg,
    },
    side: {
      minWidth: 36,
    },
    rightSide: {
      alignItems: 'flex-end',
    },
    titleGroup: {
      flex: 1,
      alignItems: 'center',
    },
  });
