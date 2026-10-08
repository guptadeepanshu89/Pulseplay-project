import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Header, IconBadge, NavRow, Screen } from '@components/common';
import { ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { APP_VERSION } from '@constants/app';
import { useTheme } from '@context/ThemeContext';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AboutUs'>;

const LOGO_SIZE = 72;

const LINKS = ['Terms of Service', 'Privacy Policy', 'Responsible Play'];

export function AboutUsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <Header title="About Us" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <IconBadge icon="pulse" size={LOGO_SIZE} borderRadius={radius.xl} style={styles.logo} />
          <AppText variant="h2">PulsePlay</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Version {APP_VERSION}
          </AppText>
        </View>

        <AppText variant="body" color={colors.textSecondary} style={styles.description}>
          PulsePlay is a multi-category prediction and market platform covering cricket, football, crypto
          price movement, and elections. This app uses virtual currency for entertainment purposes only —
          no real money is ever deposited, wagered, or withdrawn.
        </AppText>

        <Card padding="none" style={styles.linksCard}>
          {LINKS.map((link, index) => (
            <NavRow key={link} label={link} divider={index !== LINKS.length - 1} />
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.xxxl,
    },
    brand: {
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xl,
    },
    logo: {
      marginBottom: spacing.sm,
    },
    description: {
      marginBottom: spacing.xl,
    },
    linksCard: {
      paddingHorizontal: spacing.lg,
    },
  });
