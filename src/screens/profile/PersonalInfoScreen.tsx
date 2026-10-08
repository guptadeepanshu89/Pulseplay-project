import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Header, Screen } from '@components/common';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useAuth } from '@context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalInfo'>;
type IoniconName = keyof typeof Ionicons.glyphMap;

interface InfoRow {
  label: string;
  value: string;
  icon: IoniconName;
}

export function PersonalInfoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();

  const rows: InfoRow[] = [
    { label: 'Full Name', value: user?.name ?? '', icon: 'person-outline' },
    { label: 'Email', value: user?.email ?? '', icon: 'mail-outline' },
    { label: 'Mobile Number', value: user?.mobile ?? '', icon: 'call-outline' },
  ];

  return (
    <Screen>
      <Header title="Personal Information" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding="none" style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
              <Ionicons name={row.icon} size={layout.iconSizeSmall} color={colors.textSecondary} />
              <View style={styles.rowText}>
                <AppText variant="caption" color={colors.textSecondary}>
                  {row.label}
                </AppText>
                <AppText variant="bodyMedium">{row.value}</AppText>
              </View>
            </View>
          ))}
        </Card>
        <AppText variant="caption" color={colors.textMuted} align="center" style={styles.note}>
          These details are fixed for your account and cannot be edited. Contact support if something needs to
          change.
        </AppText>
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
    card: {
      paddingHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowText: {
      gap: spacing.xxs,
    },
    note: {
      marginTop: spacing.lg,
    },
  });
