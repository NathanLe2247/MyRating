import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

// iOS SF Symbol / Android Material Symbol pairs for the icons used on the
// app's screens. `web` reuses the Material name.
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
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  xCircle: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  person: { ios: 'person', android: 'person', web: 'person' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  at: { ios: 'at', android: 'alternate_email', web: 'alternate_email' },
  cake: { ios: 'birthday.cake', android: 'cake', web: 'cake' },
  paddle: { ios: 'figure.pickleball', android: 'sports_tennis', web: 'sports_tennis' },
  verified: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  tune: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  shield: { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' },
  court: { ios: 'sportscourt', android: 'sports_tennis', web: 'sports_tennis' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  trendUp: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
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
