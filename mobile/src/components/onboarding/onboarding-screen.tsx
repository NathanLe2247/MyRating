import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandIcon } from '@/components/brand-icon';
import { BrandLogo } from '@/components/auth/brand-logo';
import { OnboardingStepCount } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type OnboardingScreenProps = {
  /** 1-based step number. */
  step: number;
  stepLabel: string;
  headerSubtitle: string;
  title: string;
  subtitle: string;
  onSkip: () => void;
  /** Omitted when there's nothing to go back to (e.g. step 1 right after sign-up). */
  onBack?: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content: the primary action and its note. */
  footer: ReactNode;
};

// Shared shell for onboarding steps: brand header, step progress with "skip",
// a big title, the form, and a pinned footer. Always dark, like (auth).
export function OnboardingScreen({
  step,
  stepLabel,
  headerSubtitle,
  title,
  subtitle,
  onSkip,
  onBack,
  children,
  footer,
}: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.column}>
          <View style={styles.header}>
            {onBack && (
              <Pressable
                onPress={onBack}
                hitSlop={Spacing.two}
                accessibilityRole="button"
                accessibilityLabel={en.onboarding.back}>
                <BrandIcon name="back" color={Brand.text} size={22} />
              </Pressable>
            )}
            <BrandLogo size={HEADER_LOGO} />
            <View style={styles.headerText}>
              <Text style={styles.brand}>{en.onboarding.brand}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            </View>
            <View style={styles.account} accessibilityLabel={en.onboarding.account}>
              <BrandIcon name="person" color={Brand.onLime} size={18} />
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.stepText}>
              <Text style={styles.stepNumber}>{en.onboarding.step(step, OnboardingStepCount)}</Text>
              {` • ${stepLabel}`}
            </Text>
            <Pressable onPress={onSkip} hitSlop={Spacing.two} accessibilityRole="button">
              <Text style={styles.skip}>{en.onboarding.skip}</Text>
            </Pressable>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(step / OnboardingStepCount) * 100}%` }]} />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.titleDot} />
            </View>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {children}
          </ScrollView>

          <View style={styles.footer}>{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TITLE_DOT = 10;
const HEADER_LOGO = 36;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: BrandSizes.authMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  headerSubtitle: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
  account: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.headerButton / 2,
    backgroundColor: Brand.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  stepText: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
  stepNumber: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  skip: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  track: {
    height: BrandSizes.progressBar,
    borderRadius: BrandSizes.progressBar / 2,
    backgroundColor: Brand.border,
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BrandSizes.progressBar / 2,
    backgroundColor: Brand.lime,
  },
  scroll: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: -Spacing.three,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 34,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  titleDot: {
    width: TITLE_DOT,
    height: TITLE_DOT,
    borderRadius: TITLE_DOT / 2,
    backgroundColor: Brand.lime,
    boxShadow: `0 0 10px ${Brand.limeGlow}`,
  },
  subtitle: {
    fontFamily: BrandFonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textMuted,
  },
  footer: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
});
