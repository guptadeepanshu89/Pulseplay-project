import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText, Card, Header, Screen, Touchable } from '@components/common';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpSupport'>;

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'Is this a real-money platform?',
    answer:
      'No. PulsePlay uses virtual currency for entertainment purposes only. Balances cannot be withdrawn or exchanged for cash.',
  },
  {
    question: 'How do I add funds to my wallet?',
    answer:
      'Go to Wallet and tap Request, or Home and tap Request. Submit an increase request with a reason, and an admin will review it.',
  },
  {
    question: 'Why was my bet slip odds updated?',
    answer:
      'Odds move with live match/market conditions. The price shown when you place a bet is locked in and will not change after placement.',
  },
  {
    question: 'What does a suspended market mean?',
    answer:
      'A market is temporarily closed to new bets, usually during fast-moving live events, until updated data is confirmed.',
  },
  {
    question: 'How do I contact support?',
    answer: 'Email support@pulseplay.app and our team will get back to you within 24 hours.',
  },
];

const CHEVRON_SIZE = 18;

export function HelpSupportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <Screen>
      <Header title="Help & Support" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {FAQS.map((faq, index) => {
          const expanded = expandedIndex === index;
          return (
            <Card key={faq.question}>
              <Touchable
                style={styles.questionRow}
                onPress={() => setExpandedIndex(expanded ? null : index)}
              >
                <AppText variant="bodyMedium" style={styles.questionText}>
                  {faq.question}
                </AppText>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={CHEVRON_SIZE}
                  color={colors.textMuted}
                />
              </Touchable>
              {expanded && (
                <AppText variant="body" color={colors.textSecondary} style={styles.answerText}>
                  {faq.answer}
                </AppText>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      padding: layout.screenPaddingHorizontal,
      paddingBottom: spacing.xxxl,
      gap: spacing.sm,
    },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    questionText: {
      flex: 1,
    },
    answerText: {
      marginTop: spacing.sm,
    },
  });
