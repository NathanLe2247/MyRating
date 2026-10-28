import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes } from '@/constants/theme';

type PlayerAvatarProps = {
  name: string;
  photoUrl?: string;
  size: number;
  /** Shows the lime presence dot in the bottom-right corner. */
  online?: boolean;
  /** Darkens the bottom of the photo (group photos in the room header). */
  shaded?: boolean;
};

// Round photo, or the name's initial when there's no photo.
export function PlayerAvatar({ name, photoUrl, size, online, shaded }: PlayerAvatarProps) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={frame}>
      <View style={[styles.circle, frame]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={[styles.initial, { fontSize: size / 2.4 }]}>{name.charAt(0)}</Text>
        )}
        {shaded && photoUrl && <View style={styles.shade} />}
      </View>
      {online && <View style={styles.presence} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    backgroundColor: Brand.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: BrandFonts.display,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    experimental_backgroundImage: `linear-gradient(to top, ${Brand.photoShade}, transparent)`,
  },
  presence: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: BrandSizes.presenceBadge,
    height: BrandSizes.presenceBadge,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
    borderWidth: 2,
    borderColor: Brand.background,
  },
});
