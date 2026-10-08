import { StyleSheet, View } from 'react-native';

import { spacing } from '@theme';
import { useTheme } from '@context/ThemeContext';

import { AppText } from './AppText';
import { Touchable } from './Touchable';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <AppText variant="h3">{title}</AppText>
      {onSeeAll && (
        <Touchable onPress={onSeeAll}>
          <AppText variant="captionMedium" color={colors.accent}>
            See All
          </AppText>
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
