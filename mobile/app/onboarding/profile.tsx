import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthError } from '@/components/auth/auth-error';
import { BrandIcon } from '@/components/auth/brand-icon';
import { AvatarPicker } from '@/components/onboarding/avatar-picker';
import { BirthDateFields } from '@/components/onboarding/birth-date-fields';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ProfileSection } from '@/components/onboarding/profile-section';
import { SegmentedControl } from '@/components/onboarding/segmented-control';
import { UsernameField } from '@/components/onboarding/username-field';
import { BirthYearLength, DominantHands, toBirthDate } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useSavePlayerProfile } from '@/hooks/use-save-player-profile';
import { useUsernameAvailability } from '@/hooks/use-username-availability';
import { en } from '@/i18n/en';
import type { DominantHand, PickedAvatar } from '@/types/profile';

const copy = en.onboarding.profile;

// Onboarding step 1. "Continue" saves everything collected so far (this form
// plus the Clerk account details) to public.users via the player-profile edge
// function, then moves on to step 2 (rating calibration).
export default function OnboardingProfileScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const { save, saving, errorCode } = useSavePlayerProfile();

  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [username, setUsername] = useState('');
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [hand, setHand] = useState<DominantHand | null>(null);
  const [skipping, setSkipping] = useState(false);

  const usernameStatus = useUsernameAvailability(username);
  const dateOfBirth = toBirthDate(month, day, year);
  // Only flag the date once all three parts are filled in.
  const dateInvalid = month !== null && !!day && year.length === BirthYearLength && !dateOfBirth;
  // A failed availability check shouldn't block — the server enforces uniqueness.
  const usernameOk = usernameStatus === 'available' || usernameStatus === 'error';
  const canContinue = usernameOk && !!dateOfBirth && hand !== null;

  const handleContinue = async () => {
    if (!dateOfBirth || !hand) return;
    const saved = await save({ username, dateOfBirth, dominantHand: hand }, avatar);
    if (saved) router.push('/onboarding/rating');
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
      step={1}
      stepLabel={copy.stepLabel}
      headerSubtitle={copy.headerSubtitle}
      title={copy.title}
      subtitle={copy.subtitle}
      onSkip={handleSkip}
      onBack={router.canGoBack() ? router.back : undefined}
      footer={
        <>
          <AuthError message={errorCode ? (copy.errors[errorCode] ?? copy.errors.fallback) : null} />
          <AuthButton
            label={copy.continue}
            onPress={handleContinue}
            loading={saving}
            disabled={!canContinue || skipping}
            trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={20} />}
          />
          <View style={styles.nextStep}>
            <BrandIcon name="lock" color={Brand.textMuted} size={12} />
            <Text style={styles.nextStepText}>{copy.nextStep}</Text>
          </View>
        </>
      }>
      <AvatarPicker value={avatar} onChange={setAvatar} />

      <ProfileSection icon="at" label={copy.username.label} tag={copy.username.tag}>
        <UsernameField value={username} onChangeText={setUsername} status={usernameStatus} />
      </ProfileSection>

      <ProfileSection icon="cake" label={copy.birthDate.label} tag={copy.birthDate.tag} tagColor={Brand.warm}>
        <BirthDateFields
          month={month}
          day={day}
          year={year}
          onChangeMonth={setMonth}
          onChangeDay={setDay}
          onChangeYear={setYear}
        />
        <Text style={[styles.hint, dateInvalid && styles.hintError]}>
          {dateInvalid ? copy.birthDate.invalid : copy.birthDate.hint}
        </Text>
      </ProfileSection>

      <ProfileSection icon="paddle" label={copy.hand.label} tag={copy.hand.tag}>
        <SegmentedControl options={DominantHands} labels={copy.hand.options} value={hand} onChange={setHand} />
      </ProfileSection>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.textMuted,
  },
  hintError: {
    color: Brand.error,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BrandSizes.gapTight,
  },
  nextStepText: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    color: Brand.textMuted,
  },
});
