import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  AppTopBar,
  Avatar,
  Badge,
  Card,
  FilterTabs,
  IconBadge,
  NavRow,
  Screen,
  SectionHeader,
  Touchable,
} from '@components/common';
import { ColorPalette, radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { APP_VERSION } from '@constants/app';
import { useAuth } from '@context/AuthContext';
import { ThemeMode, useTheme } from '@context/ThemeContext';
import { useWallet } from '@context/WalletContext';
import { formatCurrency } from '@utils/formatCurrency';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IoniconName = keyof typeof Ionicons.glyphMap;
type NavigableRoute = 'PersonalInfo' | 'ChangePassword' | 'HelpSupport' | 'AboutUs' | 'DemoLive';

interface SettingsItem {
  label: string;
  icon: IoniconName;
  route: NavigableRoute;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const SECTIONS: SettingsSection[] = [
  {
    title: 'Account',
    items: [
      { label: 'Personal Information', icon: 'person-outline', route: 'PersonalInfo' },
      { label: 'Change Password', icon: 'key-outline', route: 'ChangePassword' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help & Support', icon: 'help-circle-outline', route: 'HelpSupport' },
      { label: 'About Us', icon: 'information-circle-outline', route: 'AboutUs' },
      { label: 'Live demo', icon: 'pulse-outline', route: 'DemoLive' },
    ],
  },
];

const ICON_SIZE = 20;
const WALLET_ICON_SIZE = 36;

const APPEARANCE_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export function ProfileSecurityScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, mode, setMode } = useTheme();
  const styles = createStyles(colors);
  const { user, logout } = useAuth();
  const { wallet } = useWallet();

  return (
    <Screen>
      <AppTopBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.identityCard}>
          <Avatar name={user?.name ?? 'User'} size={72} />
          <AppText variant="h2" style={styles.name}>
            {user?.name}
          </AppText>
          {user?.userCode && (
            <View>
              <Badge label={user.userCode} />
            </View>
          )}

          <View style={styles.identityDivider} />

          <Touchable
            style={styles.walletRow}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
          >
            <IconBadge icon="wallet-outline" size={WALLET_ICON_SIZE} iconSize={layout.iconSizeSmall} />
            <View style={styles.walletDetails}>
              <AppText variant="caption" color={colors.textSecondary}>
                Wallet Balance
              </AppText>
              <AppText variant="bodySemibold">{formatCurrency(wallet?.availableBalance ?? 0)}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={ICON_SIZE} color={colors.textMuted} />
          </Touchable>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Appearance" />
          <Card padding="none">
            <FilterTabs options={APPEARANCE_OPTIONS} value={mode} onChange={setMode} />
          </Card>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </AppText>
            <Card padding="none" style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <NavRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  onPress={() => navigation.navigate(item.route)}
                  divider={index !== section.items.length - 1}
                />
              ))}
            </Card>
          </View>
        ))}

        <Touchable style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={ICON_SIZE} color={colors.negative} />
          <AppText variant="bodySemibold" color={colors.negative}>
            Logout
          </AppText>
        </Touchable>

        <AppText variant="caption" color={colors.textMuted} align="center" style={styles.footer}>
          PulsePlay &middot; Version {APP_VERSION}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    identityCard: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    name: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    identityDivider: {
      alignSelf: 'stretch',
      height: 1,
      backgroundColor: colors.border,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    walletRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    walletDetails: {
      flex: 1,
      gap: spacing.xxs,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      marginBottom: spacing.sm,
      letterSpacing: 0.5,
    },
    sectionCard: {
      paddingHorizontal: spacing.lg,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.negative,
    },
    footer: {
      marginTop: spacing.xl,
    },
  });
