import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

// iOS SF Symbol / Android Material Symbol pairs for the icons used on the
// auth screens. `web` reuses the Material name.
const ICONS = {
  identifier: { ios: 'person.badge.key', android: 'passkey', web: 'passkey' },
  email: { ios: 'envelope', android: 'mail', web: 'mail' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  sms: { ios: 'message', android: 'sms', web: 'sms' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  key: { ios: 'key', android: 'key', web: 'key' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
} satisfies Record<string, SymbolName>;

export type BrandIconName = keyof typeof ICONS;

type BrandIconProps = {
  name: BrandIconName;
  color: string;
  size?: number;
};

export function BrandIcon({ name, color, size = 20 }: BrandIconProps) {
  return <SymbolView name={ICONS[name]} tintColor={color} size={size} />;
}
