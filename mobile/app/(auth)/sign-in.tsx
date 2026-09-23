import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { en } from '@/i18n/en';

type Step = 'form' | 'verify-email';

type FinalizeArgs = {
  session?: { currentTask?: unknown };
  decorateUrl: (url: string) => string;
};

export default function SignInScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();

  const [step, setStep] = useState<Step>('form');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const busy = signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching';

  // Shared finalize step for both sign-in and sign-up — converts a
  // `complete` attempt into the active session and routes home. Session
  // tasks (forced MFA enrollment, org selection) would need their own
  // screen; none are configured for this instance yet.
  const navigateAfterAuth = useCallback(
    ({ session, decorateUrl }: FinalizeArgs) => {
      if (session?.currentTask) return;
      const url = decorateUrl('/');
      if (Platform.OS === 'web' && url.startsWith('http')) {
        window.location.href = url;
      } else {
        router.replace(url as never);
      }
    },
    [router]
  );

  const handleSubmit = async () => {
    setFormError(null);

    // Combined sign-in-or-up: try signing in first. If the email isn't
    // recognized, fall through to creating an account with the same
    // credentials instead of showing a dead-end error.
    const { error } = await signIn.password({ emailAddress, password });

    if (!error) {
      if (signIn.status === 'complete') {
        await signIn.finalize({ navigate: navigateAfterAuth });
      } else if (signIn.status === 'needs_second_factor') {
        setFormError(en.auth.signIn.needsSecondFactor);
      }
      return;
    }

    if (error.code === 'form_identifier_not_found') {
      const { error: signUpError } = await signUp.password({ emailAddress, password });
      if (signUpError) {
        setFormError(signUpError.longMessage ?? signUpError.message ?? en.auth.signIn.accountCreationFailed);
        return;
      }
      await signUp.verifications.sendEmailCode();
      setStep('verify-email');
      return;
    }

    setFormError(error.longMessage ?? error.message ?? en.auth.signIn.signInFailed);
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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {en.auth.verifyEmail.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>{en.auth.verifyEmail.subtitle(emailAddress)}</ThemedText>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={en.auth.verifyEmail.codePlaceholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          {formError && <ThemedText style={styles.error}>{formError}</ThemedText>}

          <Pressable
            onPress={handleVerify}
            disabled={busy || !code}
            style={[styles.button, { backgroundColor: theme.text, opacity: busy || !code ? 0.5 : 1 }]}>
            <ThemedText style={[styles.buttonText, { color: theme.background }]}>
              {busy ? en.auth.verifyEmail.verifying : en.auth.verifyEmail.verify}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => setStep('form')}>
            <ThemedText type="linkPrimary" style={styles.link}>
              {en.auth.verifyEmail.back}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          {en.auth.signIn.title}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{en.auth.signIn.subtitle}</ThemedText>

        <TextInput
          value={emailAddress}
          onChangeText={setEmailAddress}
          placeholder={en.auth.signIn.emailPlaceholder}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={en.auth.signIn.passwordPlaceholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="password"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        {formError && <ThemedText style={styles.error}>{formError}</ThemedText>}

        {/* Required mount point for Clerk's bot protection on sign-up. */}
        <View nativeID="clerk-captcha" />

        <Pressable
          onPress={handleSubmit}
          disabled={busy || !emailAddress || !password}
          style={[
            styles.button,
            { backgroundColor: theme.text, opacity: busy || !emailAddress || !password ? 0.5 : 1 },
          ]}>
          <ThemedText style={[styles.buttonText, { color: theme.background }]}>
            {busy ? en.auth.signIn.pleaseWait : en.auth.signIn.continue}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  error: {
    color: '#E5484D',
    textAlign: 'center',
  },
});
