import { StyleSheet } from 'react-native';

import { Brand, BrandFonts } from '@/constants/theme';

// Text styles shared by the Match Found cards (the design's label / caption /
// heading roles), so each card only overrides color or alignment.
export const matchText = StyleSheet.create({
  /** Small uppercase label, e.g. "Logistics & venue". */
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  /** Secondary body text, e.g. "1.4 mi away". */
  caption: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  /** Card row heading, e.g. a player or venue name. */
  heading: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    color: Brand.text,
  },
});
