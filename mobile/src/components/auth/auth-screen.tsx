import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/auth/brand-logo';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type AuthScreenProps = {
  title: string;
  subtitle: string;
  /** Form content, rendered inside the card. */
  children: ReactNode;
  /** Links under the card (forgot password, switch to sign up/in). */
  footer?: ReactNode;
};

// Shared shell for the (auth) screens: always-dark background, logo, heading,
// a card for the form, and an optional footer below it.
export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BrandLogo />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.card}>{children}</View>

          {footer && <View style={styles.footer}>{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: BrandSizes.authMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  title: {
    marginTop: Spacing.five,
    fontFamily: BrandFonts.display,
    fontSize: 34,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.two,
    fontFamily: BrandFonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.cardRadius,
    padding: Spacing.four,
    gap: Spacing.four,
    // Faint lime wash along the top edge of the card, as in the mock.
    boxShadow: `0 -12px 40px -24px ${Brand.limeGlow}`,
  },
  footer: {
    marginTop: Spacing.five,
    alignItems: 'center',
    gap: Spacing.four,
  },
});
