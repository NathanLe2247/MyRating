import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthCheckbox } from '@/components/auth/auth-checkbox';
import { AuthCodeField } from '@/components/auth/auth-code-field';
import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthError } from '@/components/auth/auth-error';
import { AuthField } from '@/components/auth/auth-field';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandIcon } from '@/components/auth/brand-icon';
import { GoogleIcon } from '@/components/auth/google-icon';
import { VerificationCodeLength } from '@/constants/auth';
import { toUsE164 } from '@/constants/phone';
import { Brand, BrandFonts } from '@/constants/theme';
import { useAuthNavigate } from '@/hooks/use-auth-navigate';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { en } from '@/i18n/en';

type Step = 'form' | 'verify-phone';

export default function SignInScreen() {
  const router = useRouter();
  const navigateAfterAuth = useAuthNavigate();
  const { signIn, fetchStatus } = useSignIn();
  const google = useGoogleSignIn();

  const [step, setStep] = useState<Step>('form');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // TODO: not wired yet — Clerk's token cache always persists the session.
  // Decide what unchecking should do (e.g. sign out on next cold start).
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';
  // Phone numbers sign in with an SMS code — phone sign-ups have no password.
  const phoneNumber = toUsE164(identifier);

  const finishSignIn = async () => {
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: navigateAfterAuth });
    } else if (signIn.status === 'needs_second_factor') {
      setFormError(en.auth.signIn.needsSecondFactor);
    }
  };

  const sendPhoneCode = async (phone: string) => {
    const { error } = await signIn.phoneCode.sendCode({ phoneNumber: phone });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.signIn.signInFailed);
      return false;
    }
    return true;
  };

  const handleLogIn = async () => {
    setFormError(null);
    if (phoneNumber) {
      if (await sendPhoneCode(phoneNumber)) {
        setCode('');
        setStep('verify-phone');
      }
      return;
    }

    const { error } = await signIn.password({ identifier: identifier.trim(), password });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.signIn.signInFailed);
      return;
    }
    await finishSignIn();
  };

  const handleVerifyPhone = async () => {
    setFormError(null);
    const { error } = await signIn.phoneCode.verifyCode({ code });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.verifyCode.codeInvalid);
      return;
    }
    await finishSignIn();
  };

  const handleResend = async () => {
    setFormError(null);
    if (phoneNumber) await sendPhoneCode(phoneNumber);
  };

  if (step === 'verify-phone' && phoneNumber) {
    return (
      <AuthScreen
        title={en.auth.verifyPhone.title}
        subtitle={en.auth.verifyPhone.subtitle(identifier.trim())}
        footer={
          <>
            <AuthLink variant="muted" label={en.auth.verifyCode.resend} onPress={handleResend} />
            <AuthLink
              variant="muted"
              label={en.auth.verifyPhone.back}
              onPress={() => {
                setFormError(null);
                setStep('form');
              }}
            />
          </>
        }>
        <AuthCodeField icon="sms" value={code} onChangeText={setCode} onSubmitEditing={handleVerifyPhone} />
        <AuthError message={formError} />
        <AuthButton
          label={en.auth.verifyCode.verify}
          onPress={handleVerifyPhone}
          loading={busy}
          disabled={code.length !== VerificationCodeLength}
          trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={en.auth.signIn.title}
      subtitle={en.auth.signIn.subtitle}
      footer={
        <>
          <AuthLink
            variant="muted"
            icon="key"
            label={en.auth.signIn.forgotLong}
            onPress={() => router.push('/forgot-password')}
          />
          <AuthLink
            variant="cta"
            prompt={en.auth.signIn.noAccount}
            label={en.auth.signIn.signUp}
            onPress={() => router.push('/sign-up')}
          />
        </>
      }>
      <AuthField
        label={en.auth.signIn.identifierLabel}
        icon="identifier"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder={en.auth.signIn.identifierPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType={phoneNumber ? 'go' : 'next'}
        onSubmitEditing={phoneNumber ? handleLogIn : undefined}
      />
      {!phoneNumber && (
        <AuthField
          label={en.auth.fields.passwordLabel}
          icon="lock"
          labelAccessory={
            <AuthLink label={en.auth.signIn.forgotShort} onPress={() => router.push('/forgot-password')} />
          }
          secure
          showLabel={en.auth.fields.showPassword}
          hideLabel={en.auth.fields.hidePassword}
          value={password}
          onChangeText={setPassword}
          placeholder={en.auth.fields.passwordPlaceholder}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogIn}
        />
      )}

      <AuthCheckbox
        label={en.auth.signIn.keepLoggedIn}
        checked={keepLoggedIn}
        onChange={setKeepLoggedIn}
        trailing={<Text style={styles.encrypted}>{en.auth.signIn.encrypted}</Text>}
      />

      <AuthError message={formError ?? google.error} />

      <AuthButton
        label={phoneNumber ? en.auth.signIn.textCode : en.auth.signIn.logIn}
        onPress={handleLogIn}
        loading={busy}
        disabled={!identifier || (!phoneNumber && !password) || google.pending}
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

const styles = StyleSheet.create({
  encrypted: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.textFaint,
  },
});
