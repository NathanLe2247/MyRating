import { StyleSheet } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

// Card and type styles shared by the Health tab's sections.
export const healthStyles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  /** Recessed tile inside a card (metric pillars, summary cells); square in Figma. */
  inset: {
    backgroundColor: Brand.input,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  eyebrow: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  heading: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  caption: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  chip: {
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: Brand.chip,
  },
  chipLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
});
