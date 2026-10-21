import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { ColorPalette, spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';
import { Touchable } from './Touchable';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface NavRowProps {
  icon?: IoniconName;
  label: string;
  onPress?: () => void;
  divider?: boolean;
  style?: ViewStyle;
}

const LEADING_ICON_SIZE = 20;
const CHEVRON_SIZE = 18;

export function NavRow({ icon, label, onPress, divider = false, style }: NavRowProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const rowStyle = [styles.row, divider && styles.divider, style];

  const content = (
    <>
      {icon && <Ionicons name={icon} size={LEADING_ICON_SIZE} color={colors.textSecondary} />}
      <AppText variant="bodyMedium" style={styles.label}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={colors.textMuted} />
    </>
  );

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Touchable style={rowStyle} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Touchable>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      flex: 1,
    },
  });
