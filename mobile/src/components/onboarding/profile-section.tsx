import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes } from '@/constants/theme';

type ProfileSectionProps = {
  icon: BrandIconName;
  label: string;
  /** Small uppercase tag at the right of the label row ("Public handle"). */
  tag?: string;
  tagColor?: string;
  children: ReactNode;
};

// One labelled group on an onboarding form: icon + label, optional tag, content.
export function ProfileSection({ icon, label, tag, tagColor = Brand.textMuted, children }: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <View style={styles.label}>
          <BrandIcon name={icon} color={Brand.lime} size={16} />
          <Text style={styles.labelText}>{label}</Text>
        </View>
        {tag && <Text style={[styles.tag, { color: tagColor }]}>{tag}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: BrandSizes.gapSnug,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  labelText: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  tag: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
