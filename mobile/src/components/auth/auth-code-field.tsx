import { AuthField } from '@/components/auth/auth-field';
import type { BrandIconName } from '@/components/auth/brand-icon';
import { VerificationCodeLength } from '@/constants/auth';
import { en } from '@/i18n/en';

type AuthCodeFieldProps = {
  value: string;
  onChangeText: (code: string) => void;
  onSubmitEditing?: () => void;
  /** `email` for emailed codes, `sms` for texted ones. */
  icon: BrandIconName;
};

// One-time code input shared by every verify step; digits only, and the OS
// can autofill it from the email/SMS.
export function AuthCodeField({ value, onChangeText, onSubmitEditing, icon }: AuthCodeFieldProps) {
  return (
    <AuthField
      label={en.auth.fields.codeLabel}
      icon={icon}
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, VerificationCodeLength))}
      placeholder={en.auth.fields.codePlaceholder}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={VerificationCodeLength}
      onSubmitEditing={onSubmitEditing}
    />
  );
}
