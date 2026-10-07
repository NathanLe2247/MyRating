import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandIcon } from '@/components/auth/brand-icon';
import { AvatarContentTypes, AvatarQuality } from '@/constants/profile';
import { Brand, BrandSizes } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { PickedAvatar } from '@/types/profile';

type AvatarPickerProps = {
  value: PickedAvatar | null;
  onChange: (avatar: PickedAvatar) => void;
};

// Round photo slot with a camera glyph and a lime "+" badge. Picks a square
// crop from the library; uploading happens on submit, not here.
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: AvatarQuality,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    // Cropped picks come back as JPEG on both platforms; fall back to that if
    // the picker reports something R2 uploads don't accept (e.g. HEIC).
    const contentType =
      asset.mimeType && AvatarContentTypes.includes(asset.mimeType) ? asset.mimeType : AvatarContentTypes[0];
    onChange({ uri: asset.uri, contentType });
  };

  return (
    <Pressable
      onPress={pick}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={value ? en.onboarding.profile.changePhoto : en.onboarding.profile.addPhoto}>
      <View style={styles.circle}>
        {value && <Image source={{ uri: value.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <BrandIcon name="camera" color={Brand.lime} size={28} />
      </View>
      <View style={styles.badge}>
        <BrandIcon name="plus" color={Brand.onLime} size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    width: BrandSizes.avatar,
    height: BrandSizes.avatar,
  },
  circle: {
    width: BrandSizes.avatar,
    height: BrandSizes.avatar,
    borderRadius: BrandSizes.avatar / 2,
    backgroundColor: Brand.card,
    borderWidth: 2,
    borderColor: Brand.logoRing,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    right: -BrandSizes.gapTight,
    bottom: 0,
    width: BrandSizes.avatarBadge,
    height: BrandSizes.avatarBadge,
    borderRadius: BrandSizes.avatarBadge / 2,
    backgroundColor: Brand.lime,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 16px ${Brand.limeGlow}`,
  },
});
