import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthLink } from '@/components/auth/auth-link';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

const copy = en.courts.signedOut;

type SignUpCtaProps = {
  onSignUp: () => void;
  onLogIn: () => void;
};

// Call to action on the signed-out courts screen: everything past the
// courts list needs an account.
export function SignUpCta({ onSignUp, onLogIn }: SignUpCtaProps) {
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.ctaTitle}
        </Text>
        <Text style={styles.body}>{copy.ctaBody}</Text>
      </View>
      <AuthButton label={copy.signUp} onPress={onSignUp} />
      <View style={styles.centered}>
        <AuthLink prompt={copy.logInPrompt} label={copy.logIn} onPress={onLogIn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    gap: Spacing.three,
  },
  text: {
    gap: Spacing.one,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textMuted,
  },
  centered: {
    alignItems: 'center',
  },
});
