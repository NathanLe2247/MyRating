import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandIcon } from '@/components/auth/brand-icon';
import { normalizeUsername, UsernameMaxLength } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { UsernameStatus } from '@/types/profile';

type UsernameFieldProps = {
  value: string;
  onChangeText: (username: string) => void;
  status: UsernameStatus;
};

const copy = en.onboarding.profile.username;

function statusMessage(status: UsernameStatus, username: string) {
  switch (status) {
    case 'invalid':
      return copy.hint;
    case 'checking':
      return copy.checking;
    case 'available':
      return copy.available(username);
    case 'taken':
      return copy.taken(username);
    case 'error':
      return copy.error;
    default:
      return copy.hint;
  }
}

// Handle input that normalizes as you type, with a live availability line.
export function UsernameField({ value, onChangeText, status }: UsernameFieldProps) {
  const [focused, setFocused] = useState(false);
  const good = status === 'available';
  const bad = status === 'taken';
  const dotColor = good ? Brand.lime : bad ? Brand.error : Brand.textFaint;

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, bad && styles.inputWrapError]}>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(normalizeUsername(text))}
          placeholder={copy.placeholder}
          placeholderTextColor={Brand.placeholder}
          selectionColor={Brand.lime}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          maxLength={UsernameMaxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {good && <BrandIcon name="checkCircle" color={Brand.lime} size={20} />}
        {bad && <BrandIcon name="xCircle" color={Brand.error} size={20} />}
      </View>
      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.status, good && styles.statusGood, bad && styles.statusBad]}>
          {statusMessage(status, value)}
        </Text>
      </View>
    </View>
  );
}

const DOT = 6;

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: BrandSizes.control,
    paddingHorizontal: Spacing.three,
    borderRadius: BrandSizes.controlRadius,
    backgroundColor: Brand.input,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: Brand.lime,
  },
  inputWrapError: {
    borderColor: Brand.error,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: BrandFonts.body,
    fontSize: 16,
    color: Brand.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  status: {
    flex: 1,
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
  statusGood: {
    color: Brand.lime,
  },
  statusBad: {
    color: Brand.error,
  },
});
