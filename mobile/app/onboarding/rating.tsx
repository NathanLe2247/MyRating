import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthError } from '@/components/auth/auth-error';
import { BrandIcon } from '@/components/auth/brand-icon';
import { FeatureChip } from '@/components/onboarding/feature-chip';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ProtocolBanner } from '@/components/onboarding/protocol-banner';
import { RatingOptionCard } from '@/components/onboarding/rating-option-card';
import { PlacementGameCount, SupportedRatingSources } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useSaveRatingSource } from '@/hooks/use-save-rating-source';
import { en } from '@/i18n/en';
import type { RatingSource } from '@/types/profile';

const copy = en.onboarding.rating;

// Onboarding step 2 (final). The player picks how their starting rating is
// set; only "Start fresh / calibrate" is supported so far, so the DUPR and USA
// Pickleball options are shown but disabled.
export default function OnboardingRatingScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const { save, saving, errorCode } = useSaveRatingSource();
  const [source, setSource] = useState<RatingSource>('calibration');
  const [skipping, setSkipping] = useState(false);

  // Step 2 updates the row step 1 creates, so it can't come first.
  if (!onboarding.profileCompleted) return <Redirect href="/onboarding/profile" />;

  const comingSoon = (option: RatingSource) =>
    SupportedRatingSources.includes(option) ? undefined : copy.comingSoon;

  const handleContinue = async () => {
    if (await save(source)) router.replace('/');
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await onboarding.skip();
      router.replace('/');
    } finally {
      setSkipping(false);
    }
  };

  return (
    <OnboardingScreen
      step={2}
      stepLabel={copy.stepLabel}
      headerSubtitle={copy.headerSubtitle}
      title={copy.title}
      subtitle={copy.subtitle}
      onSkip={handleSkip}
      onBack={router.canGoBack() ? router.back : undefined}
      footer={
        <>
          <View style={styles.security}>
            <BrandIcon name="lock" color={Brand.textMuted} size={12} />
            <Text style={styles.securityText}>{copy.security}</Text>
          </View>
          <AuthError message={errorCode ? (copy.errors[errorCode] ?? copy.errors.fallback) : null} />
          <AuthButton
            label={copy.continue}
            onPress={handleContinue}
            loading={saving}
            disabled={skipping}
            trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={20} />}
          />
        </>
      }>
      <ProtocolBanner title={copy.protocol.title} subtitle={copy.protocol.subtitle} />

      <RatingOptionCard
        icon="verified"
        iconColor={Brand.warm}
        title={copy.options.dupr.title}
        tag={{ label: copy.options.dupr.tag, variant: 'lime' }}
        subtitle={copy.options.dupr.subtitle}
        body={copy.options.dupr.body}
        selected={source === 'dupr'}
        onPress={() => setSource('dupr')}
        disabledLabel={comingSoon('dupr')}>
        <View style={styles.chips}>
          <FeatureChip icon="bolt" iconColor={Brand.lime} label={copy.options.dupr.features.instant} />
          <FeatureChip icon="trophy" iconColor={Brand.warm} label={copy.options.dupr.features.badge} />
        </View>
      </RatingOptionCard>

      <RatingOptionCard
        icon="paddle"
        iconColor={Brand.cyan}
        title={copy.options.usa_pickleball.title}
        subtitle={copy.options.usa_pickleball.subtitle}
        body={copy.options.usa_pickleball.body}
        selected={source === 'usa_pickleball'}
        onPress={() => setSource('usa_pickleball')}
        disabledLabel={comingSoon('usa_pickleball')}
      />

      <RatingOptionCard
        icon="tune"
        iconColor={Brand.lime}
        title={copy.options.calibration.title}
        tag={{ label: copy.options.calibration.tag, variant: 'muted' }}
        subtitle={copy.options.calibration.subtitle}
        body={copy.options.calibration.body(PlacementGameCount)}
        selected={source === 'calibration'}
        onPress={() => setSource('calibration')}
        disabledLabel={comingSoon('calibration')}>
        <Text style={styles.placement}>{copy.options.calibration.placement(PlacementGameCount)}</Text>
      </RatingOptionCard>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BrandSizes.gapTight,
  },
  placement: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 0.5,
    color: Brand.lime,
  },
  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BrandSizes.gapTight,
  },
  securityText: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    color: Brand.textMuted,
    textAlign: 'center',
    flexShrink: 1,
  },
});
