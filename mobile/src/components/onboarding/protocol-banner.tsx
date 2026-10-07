import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, Spacing } from '@/constants/theme';

type ProtocolBannerProps = {
  title: string;
  subtitle: string;
};

// The pill-shaped "Official rating protocol" banner at the top of step 2.
export function ProtocolBanner({ title, subtitle }: ProtocolBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.thumb}>
        <BrandIcon name="paddle" color={Brand.lime} size={24} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const THUMB = 52;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Brand.input,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: THUMB / 2 + Spacing.two,
    padding: Spacing.two,
    paddingRight: Spacing.four,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Brand.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  subtitle: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
});
