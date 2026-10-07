import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthCodeField } from '@/components/auth/auth-code-field';
import { AuthError } from '@/components/auth/auth-error';
import { AuthField } from '@/components/auth/auth-field';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandIcon } from '@/components/brand-icon';
import { Brand } from '@/constants/theme';
import { useAuthNavigate } from '@/hooks/use-auth-navigate';
import { en } from '@/i18n/en';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const navigateAfterAuth = useAuthNavigate();
  const { signIn, fetchStatus } = useSignIn();

  const [step, setStep] = useState<Step>('email');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';

  const handleSendCode = async () => {
    setFormError(null);
    const { error: createError } = await signIn.create({ identifier: emailAddress.trim() });
    const error = createError ?? (await signIn.resetPasswordEmailCode.sendCode()).error;
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.forgotPassword.sendFailed);
      return;
    }
    setStep('reset');
  };

  const handleReset = async () => {
    setFormError(null);
    const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (verifyError) {
      setFormError(verifyError.longMessage ?? verifyError.message ?? en.auth.verifyCode.codeInvalid);
      return;
    }
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (error) {
      setFormError(error.longMessage ?? error.message ?? en.auth.forgotPassword.resetFailed);
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: navigateAfterAuth });
    } else if (signIn.status === 'needs_second_factor') {
      setFormError(en.auth.signIn.needsSecondFactor);
    }
  };

  const footer = (
    <AuthLink variant="muted" label={en.auth.forgotPassword.backToLogIn} onPress={() => router.dismissTo('/sign-in')} />
  );

  if (step === 'reset') {
    return (
      <AuthScreen
        title={en.auth.forgotPassword.title}
        subtitle={en.auth.forgotPassword.codeSubtitle(emailAddress)}
        footer={footer}>
        <AuthCodeField icon="email" value={code} onChangeText={setCode} />
        <AuthField
          label={en.auth.forgotPassword.newPasswordLabel}
          icon="lock"
          secure
          showLabel={en.auth.fields.showPassword}
          hideLabel={en.auth.fields.hidePassword}
          value={password}
          onChangeText={setPassword}
          placeholder={en.auth.fields.passwordPlaceholder}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={handleReset}
        />
        <AuthError message={formError} />
        <AuthButton
          label={en.auth.forgotPassword.resetPassword}
          onPress={handleReset}
          loading={busy}
          disabled={!code || !password}
          trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={en.auth.forgotPassword.title}
      subtitle={en.auth.forgotPassword.subtitle}
      footer={footer}>
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
        onSubmitEditing={handleSendCode}
      />
      <AuthError message={formError} />
      <AuthButton
        label={en.auth.forgotPassword.sendCode}
        onPress={handleSendCode}
        loading={busy}
        disabled={!emailAddress}
        trailing={<BrandIcon name="arrowRight" color={Brand.onLime} size={18} />}
      />
    </AuthScreen>
  );
}
