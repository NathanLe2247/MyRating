import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthError } from '@/components/auth/auth-error';
import { AuthField } from '@/components/auth/auth-field';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandIcon } from '@/components/auth/brand-icon';
import { GoogleIcon } from '@/components/auth/google-icon';
import { Brand } from '@/constants/theme';
import { useAuthNavigate } from '@/hooks/use-auth-navigate';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { en } from '@/i18n/en';

type Step = 'form' | 'verify-email';

export default function SignUpScreen() {
  const router = useRouter();
  const navigateAfterAuth = useAuthNavigate();
  const { signUp, fetchStatus } = useSignUp();
  const google = useGoogleSignIn();

  const [step, setStep] = useState<Step>('form');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';

  const handleCreate = async () => {
    setFormError(null);
    const { error } = await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.signUp.accountCreationFailed);
      return;
    }
    await signUp.verifications.sendEmailCode();
    setStep('verify-email');
  };

  const handleVerify = async () => {
    setFormError(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.verifyEmail.codeInvalid);
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: navigateAfterAuth });
    }
  };

  if (step === 'verify-email') {
    return (
      <AuthScreen
        title={en.auth.verifyEmail.title}
        subtitle={en.auth.verifyEmail.subtitle(emailAddress)}
        footer={
          <AuthLink
            variant="muted"
            label={en.auth.verifyEmail.back}
            onPress={() => {
              setCode('');
              setFormError(null);
              setStep('form');
            }}
          />
        }>
        <AuthField
          label={en.auth.fields.codeLabel}
          icon="email"
          value={code}
          onChangeText={setCode}
          placeholder={en.auth.fields.codePlaceholder}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={handleVerify}
        />
        <AuthError message={formError} />
        <AuthButton
          label={en.auth.verifyEmail.verify}
          onPress={handleVerify}
          loading={busy}
          disabled={!code}
          trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={en.auth.signUp.title}
      subtitle={en.auth.signUp.subtitle}
      footer={
        <AuthLink
          variant="cta"
          prompt={en.auth.signUp.haveAccount}
          label={en.auth.signUp.logIn}
          onPress={() => router.back()}
        />
      }>
      <AuthField
        label={en.auth.fields.emailLabel}
        icon="email"
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder={en.auth.fields.emailPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <AuthField
        label={en.auth.fields.passwordLabel}
        icon="lock"
        secure
        showLabel={en.auth.fields.showPassword}
        hideLabel={en.auth.fields.hidePassword}
        value={password}
        onChangeText={setPassword}
        placeholder={en.auth.fields.passwordPlaceholder}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleCreate}
      />

      <AuthError message={formError ?? google.error} />

      {/* Required mount point for Clerk's bot protection on sign-up. */}
      <View nativeID="clerk-captcha" />

      <AuthButton
        label={en.auth.signUp.createAccount}
        onPress={handleCreate}
        loading={busy}
        disabled={!emailAddress || !password || google.pending}
        trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
      />

      <AuthDivider label={en.auth.or} />

      <AuthButton
        variant="secondary"
        label={en.auth.google.continue}
        onPress={google.signInWithGoogle}
        loading={google.pending}
        disabled={busy}
        leading={<GoogleIcon />}
      />
    </AuthScreen>
  );
}
