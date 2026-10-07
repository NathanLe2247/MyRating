import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthCodeField } from '@/components/auth/auth-code-field';
import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthError } from '@/components/auth/auth-error';
import { AuthField } from '@/components/auth/auth-field';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandIcon } from '@/components/auth/brand-icon';
import { GoogleIcon } from '@/components/auth/google-icon';
import { VerificationCodeLength } from '@/constants/auth';
import { DialCode, formatNationalNumber, isValidUsNumber, NationalNumberLength } from '@/constants/phone';
import { Brand } from '@/constants/theme';
import { useAuthNavigate } from '@/hooks/use-auth-navigate';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { en } from '@/i18n/en';

// Phone sign-up is SMS-code only (no password); email sign-up uses a password
// plus an emailed code.
type Method = 'phone' | 'email';
type Step = 'form' | 'verify';

export default function SignUpScreen() {
  const router = useRouter();
  const navigateAfterAuth = useAuthNavigate();
  const { signUp, fetchStatus } = useSignUp();
  const google = useGoogleSignIn();

  const [method, setMethod] = useState<Method>('phone');
  const [step, setStep] = useState<Step>('form');
  const [digits, setDigits] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';
  const isPhone = method === 'phone';
  const displayPhone = `${DialCode} ${formatNationalNumber(digits)}`;

  const sendCode = () =>
    isPhone ? signUp.verifications.sendPhoneCode() : signUp.verifications.sendEmailCode();

  const handleCreate = async () => {
    setFormError(null);
    if (isPhone && !isValidUsNumber(digits)) {
      setFormError(en.auth.signUp.invalidPhone);
      return;
    }

    const { error } = isPhone
      ? await signUp.create({ phoneNumber: `${DialCode}${digits}` })
      : await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setFormError(
        isPhone && error.code === 'form_identifier_exists'
          ? en.auth.signUp.phoneTaken
          : (error.longMessage ?? error.message ?? en.auth.signUp.accountCreationFailed)
      );
      return;
    }

    const { error: sendError } = await sendCode();
    if (sendError) {
      setFormError(sendError.longMessage ?? sendError.message ?? en.auth.signUp.sendCodeFailed);
      return;
    }
    setCode('');
    setStep('verify');
  };

  const handleResend = async () => {
    setFormError(null);
    const { error } = await sendCode();
    if (error) setFormError(error.longMessage ?? error.message ?? en.auth.signUp.sendCodeFailed);
  };

  const handleVerify = async () => {
    setFormError(null);
    const { error } = isPhone
      ? await signUp.verifications.verifyPhoneCode({ code })
      : await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.verifyCode.codeInvalid);
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: navigateAfterAuth });
    } else {
      // Verified, but the Clerk instance requires fields this screen doesn't
      // collect (e.g. a password for phone sign-ups) — fix in the dashboard.
      setFormError(en.auth.verifyCode.incomplete(signUp.missingFields.join(', ')));
    }
  };

  const backToForm = () => {
    setCode('');
    setFormError(null);
    setStep('form');
  };

  const switchMethod = () => {
    setFormError(null);
    setMethod(isPhone ? 'email' : 'phone');
  };

  if (step === 'verify') {
    const copy = isPhone ? en.auth.verifyPhone : en.auth.verifyEmail;
    return (
      <AuthScreen
        title={copy.title}
        subtitle={copy.subtitle(isPhone ? displayPhone : emailAddress)}
        footer={
          <>
            <AuthLink variant="muted" label={en.auth.verifyCode.resend} onPress={handleResend} />
            <AuthLink variant="muted" label={copy.back} onPress={backToForm} />
          </>
        }>
        <AuthCodeField
          icon={isPhone ? 'sms' : 'email'}
          value={code}
          onChangeText={setCode}
          onSubmitEditing={handleVerify}
        />
        <AuthError message={formError} />
        <AuthButton
          label={en.auth.verifyCode.verify}
          onPress={handleVerify}
          loading={busy}
          disabled={code.length !== VerificationCodeLength}
          trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
        />
      </AuthScreen>
    );
  }

  const formIncomplete = isPhone ? digits.length !== NationalNumberLength : !emailAddress || !password;

  return (
    <AuthScreen
      title={en.auth.signUp.title}
      subtitle={en.auth.signUp.subtitle}
      footer={
        <>
          <AuthLink
            variant="muted"
            icon={isPhone ? 'email' : 'phone'}
            label={isPhone ? en.auth.signUp.useEmail : en.auth.signUp.usePhone}
            onPress={switchMethod}
          />
          <AuthLink
            variant="cta"
            prompt={en.auth.signUp.haveAccount}
            label={en.auth.signUp.logIn}
            onPress={() => router.back()}
          />
        </>
      }>
      {isPhone ? (
        <AuthField
          label={en.auth.fields.phoneLabel}
          icon="phone"
          value={formatNationalNumber(digits)}
          onChangeText={(text) => setDigits(text.replace(/\D/g, '').slice(0, NationalNumberLength))}
          placeholder={en.auth.fields.phonePlaceholder}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          onSubmitEditing={handleCreate}
        />
      ) : (
        <>
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
        </>
      )}

      <AuthError message={formError ?? google.error} />

      {/* Required mount point for Clerk's bot protection on sign-up. */}
      <View nativeID="clerk-captcha" />

      <AuthButton
        label={isPhone ? en.auth.signUp.sendCode : en.auth.signUp.createAccount}
        onPress={handleCreate}
        loading={busy}
        disabled={formIncomplete || google.pending}
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
