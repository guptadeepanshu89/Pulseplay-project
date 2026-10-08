import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { ColorPalette, radius, spacing, typography } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  icon?: IoniconName;
  error?: string;
}

const ICON_SIZE = 18;
const FIELD_HEIGHT = 52;

export function TextField({ label, icon, error, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="captionMedium" color={colors.textSecondary} style={styles.label}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.field,
          { borderColor: error ? colors.negative : focused ? colors.accent : colors.border },
        ]}
      >
        {icon && <Ionicons name={icon} size={ICON_SIZE} color={colors.textMuted} style={styles.icon} />}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          {...inputProps}
        />
      </View>
      {error && (
        <AppText variant="caption" color={colors.negative} style={styles.error}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    label: {
      marginBottom: spacing.xs,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      height: FIELD_HEIGHT,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    icon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      height: '100%',
      color: colors.textPrimary,
      ...typography.body,
    },
    error: {
      marginTop: spacing.xs,
    },
  });
