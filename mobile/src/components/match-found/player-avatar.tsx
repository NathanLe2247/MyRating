import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { isR2PublicUrl } from '@/config/r2';
import { Brand, BrandFonts } from '@/constants/theme';

type PlayerAvatarProps = {
  name: string;
  uri?: string;
  size: number;
};

// Round player photo; falls back to the player's initials when there's no
// photo, or when the URL isn't in the app's R2 bucket (never load arbitrary
// remote images).
export function PlayerAvatar({ name, uri, size }: PlayerAvatarProps) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  if (uri && isR2PublicUrl(uri)) return <Image source={{ uri }} style={[styles.base, frame]} contentFit="cover" />;

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.base, styles.fallback, frame]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    boxShadow: `0 4px 6px -1px ${Brand.shadowSoft}`,
  },
  fallback: {
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: BrandFonts.displaySemiBold,
    color: Brand.textMuted,
  },
});
