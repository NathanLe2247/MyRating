import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type MetaLineProps = {
  icon: BrandIconName;
  /** Shown in order with a dimmed separator; empty parts are dropped. */
  parts: string[];
};

// Small muted line under a card title, e.g. "1.2 mi away · South Austin".
export function MetaLine({ icon, parts }: MetaLineProps) {
  const shown = parts.filter(Boolean);
  return (
    <View style={styles.row}>
      <BrandIcon name={icon} color={Brand.textMuted} size={11} />
      {shown.map((part, i) => (
        <Fragment key={`${i}-${part}`}>
          {i > 0 && <Text style={[styles.text, styles.separator]}>{en.home.recent.separator}</Text>}
          <Text style={styles.text} numberOfLines={1}>
            {part}
          </Text>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  text: {
    flexShrink: 1,
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  separator: {
    flexShrink: 0,
    opacity: 0.4,
  },
});
