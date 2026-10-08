import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface EmptyStateProps {
  icon: IoniconName;
  title: string;
  message?: string;
}

const ICON_SIZE = 40;

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={ICON_SIZE} color={colors.textMuted} />
      <AppText variant="bodySemibold" style={styles.title}>
        {title}
      </AppText>
      {message && (
        <AppText variant="body" color={colors.textSecondary} align="center">
          {message}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.sm,
  },
});
