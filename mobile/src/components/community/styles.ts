import { StyleSheet } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

// Type and chip styles repeated across the Community tab's components.
export const communityText = StyleSheet.create({
  /** Condensed caps label, e.g. "Joined squads", "Court". */
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  /** Condensed figure or tag, e.g. "248", "DUPR 4.22". */
  stat: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    color: Brand.lime,
  },
  /** Condensed caps button / chip text. */
  button: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  /** Large condensed caps, e.g. room title, challenger name. */
  title: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  /** Small body text, e.g. member count, timestamps. */
  meta: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.text,
  },
  onLime: {
    color: Brand.onLime,
  },
});

export const communityStyles = StyleSheet.create({
  /** Small rounded count / tag badge. */
  pill: {
    backgroundColor: Brand.cardRaised,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: BrandSizes.gapTight,
    paddingVertical: BrandSizes.chipPaddingY,
  },
  pillOnLime: {
    backgroundColor: Brand.onLime,
  },
  /** Round icon button. */
  iconButton: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
});
