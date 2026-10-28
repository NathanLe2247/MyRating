import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { CourtCardData, VenueTag, VenueTagTone } from '@/types/play';

const copy = en.play.courts;

type CourtCardProps = {
  court: CourtCardData;
  onPress?: () => void;
  onDirections?: () => void;
  onPrimaryAction?: () => void;
};

const TAG_COLORS: Record<VenueTagTone, string> = {
  default: Brand.textMuted,
  strong: Brand.text,
  lime: Brand.lime,
  indoor: Brand.indoor,
};

export function CourtCard({ court, onPress, onDirections, onPrimaryAction }: CourtCardProps) {
  const indoor = court.setting === 'indoor';
  const accent = indoor ? Brand.indoor : Brand.lime;
  const badge = indoor
    ? { bg: Brand.indoorSurface, fg: Brand.indoor }
    : court.featured
      ? { bg: Brand.limeSurface, fg: Brand.lime }
      : { bg: Brand.chip, fg: Brand.textMuted };
  const noteColor = indoor ? Brand.warm : court.featured ? Brand.lime : Brand.textMuted;

  return (
    // The action row sits outside the card's pressable area: nested buttons
    // would be swallowed by the outer one for screen readers.
    <View style={styles.card}>
      {court.featured && <View style={styles.accentBar} />}

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={court.name}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}>
        <View style={styles.top}>
          <View style={styles.titleBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>
                {court.name}
              </Text>
              {court.verified && <BrandIcon name="verified" color={Brand.lime} size={16} />}
            </View>
            <View style={styles.metaRow}>
              <BrandIcon name="location" color={Brand.textMuted} size={11} />
              <Text style={styles.meta}>{copy.distance(court.distanceMiles)}</Text>
              <Text style={[styles.meta, styles.separator]}>{en.play.separator}</Text>
              <Text style={styles.meta}>{court.neighborhood}</Text>
            </View>
          </View>
          <View style={styles.countBlock}>
            <View style={[styles.countBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.chipLabel, { color: badge.fg }]}>
                {indoor ? copy.indoorCount(court.courtCount) : copy.courtCount(court.courtCount)}
              </Text>
            </View>
            {court.note && <Text style={[styles.note, { color: noteColor }]}>{court.note}</Text>}
          </View>
        </View>

        {court.photoUrl && (
          <View style={styles.photo}>
            <Image source={court.photoUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
            {court.photoCaption && (
              <View style={styles.caption}>
                <View style={[styles.captionDot, { backgroundColor: accent }]} />
                <Text style={[styles.chipLabel, { color: indoor ? Brand.indoor : Brand.text }]}>
                  {court.photoCaption}
                </Text>
              </View>
            )}
          </View>
        )}

        {court.description && <Text style={styles.description}>{court.description}</Text>}

        {court.tags.length > 0 && (
          <View style={styles.tags}>
            {court.tags.map((tag) => (
              <Tag key={tag.label} tag={tag} />
            ))}
          </View>
        )}
      </Pressable>

      <View style={styles.actions}>
        <ActionButton
          icon="directions"
          label={
            court.primaryAction ? copy.directions : copy.directionsWithDistance(court.distanceMiles)
          }
          background={Brand.chip}
          color={Brand.text}
          onPress={onDirections}
        />
        {court.primaryAction && (
          <ActionButton
            icon={court.primaryAction === 'book' ? 'calendar' : 'check'}
            label={court.primaryAction === 'book' ? copy.bookCourt : copy.checkIn}
            background={accent}
            color={indoor ? Brand.onIndoor : Brand.onLime}
            onPress={onPrimaryAction}
          />
        )}
      </View>
    </View>
  );
}

function Tag({ tag }: { tag: VenueTag }) {
  const color = TAG_COLORS[tag.tone ?? 'default'];
  return (
    <View style={styles.tag}>
      {tag.icon && <BrandIcon name={tag.icon} color={color} size={12} />}
      <Text style={[styles.chipLabel, { color }]}>{tag.label}</Text>
    </View>
  );
}

type ActionButtonProps = {
  icon: BrandIconName;
  label: string;
  background: string;
  color: string;
  onPress?: () => void;
};

function ActionButton({ icon, label, background, color, onPress }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}>
      <BrandIcon name={icon} color={color} size={14} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.cardRadius,
    padding: Spacing.three,
    gap: BrandSizes.gapSnug,
    overflow: 'hidden',
  },
  content: {
    gap: BrandSizes.gapSnug,
  },
  pressed: {
    opacity: 0.85,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BrandSizes.accentBar,
    backgroundColor: Brand.lime,
    experimental_backgroundImage: `linear-gradient(90deg, ${Brand.lime} 0%, ${Brand.limeSurface} 100%)`,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
    fontFamily: BrandFonts.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meta: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  separator: {
    opacity: 0.4,
    paddingHorizontal: Spacing.one,
  },
  countBlock: {
    alignItems: 'flex-end',
  },
  countBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BrandSizes.pillRadius,
  },
  chipLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
  note: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 20,
  },
  photo: {
    height: BrandSizes.venuePhoto,
    borderRadius: Spacing.half,
    overflow: 'hidden',
    backgroundColor: Brand.input,
  },
  caption: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.background,
  },
  captionDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
  },
  description: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BrandSizes.gapTight,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: BrandSizes.gapMid,
    borderRadius: BrandSizes.pillRadius,
  },
  actionLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
});
