import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Chip } from '@/components/play/chip';
import { MetaLine } from '@/components/play/meta-line';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { CourtCardData, VenueTagTone } from '@/types/play';
import { courtDirectionsUrl } from '@/utils/maps';

const copy = en.play.courts;

type CourtCardProps = {
  court: CourtCardData;
  onPress?: () => void;
  onPrimaryAction?: () => void;
};

const TAG_COLORS: Record<VenueTagTone, string> = {
  default: Brand.textMuted,
  strong: Brand.text,
  lime: Brand.lime,
  indoor: Brand.indoor,
};

export function CourtCard({ court, onPress, onPrimaryAction }: CourtCardProps) {
  const { location } = court;
  // A failed open (no browser or maps app) leaves the user on the card;
  // there is nothing more useful to show, so the rejection is dropped.
  const openDirections = location
    ? () => Linking.openURL(courtDirectionsUrl(location, court.name)).catch(() => undefined)
    : undefined;
  const indoor = court.setting === 'indoor';
  const accent = indoor ? Brand.indoor : Brand.lime;
  const badge = indoor
    ? { bg: Brand.indoorSurface, fg: Brand.indoor }
    : court.featured
      ? { bg: Brand.limeSurface, fg: Brand.lime }
      : { bg: Brand.chip, fg: Brand.textMuted };
  const noteColor = indoor ? Brand.warm : court.featured ? Brand.lime : Brand.textMuted;
  const booking = court.primaryAction === 'book';
  // Google doesn't say how long a photo URL lasts: one that fails to load
  // leaves the card as if it had no photo. Remembering which URL failed lets
  // a new URL try again.
  const [failedUrl, setFailedUrl] = useState<string>();
  const photoUrl = court.photoUrl;
  const showPhoto = !!photoUrl && photoUrl !== failedUrl;

  // Optional strings are checked with ternaries, not `&&`: an empty string
  // from the backend would otherwise render as a bare text node and crash.
  return (
    // The action row sits outside the card's pressable area: nested buttons
    // would be swallowed by the outer one for screen readers.
    <View style={styles.card}>
      {court.featured ? <View style={styles.accentBar} /> : null}

      {/* Above the name, and outside the pressable area so the credit links
          stay separately reachable for screen readers. */}
      {showPhoto ? (
        <View style={styles.photoBlock}>
          <View style={styles.photo}>
            <Image
              // One Image per URL, so a late error from the old load can't hide the new one.
              key={photoUrl}
              source={{ uri: photoUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel={copy.a11y.photo(court.name)}
              onError={() => setFailedUrl(photoUrl)}
            />
            {court.photoCaption ? (
              <View style={styles.caption}>
                <Chip
                  dot
                  label={court.photoCaption}
                  color={indoor ? Brand.indoor : Brand.text}
                  dotColor={accent}
                  background={Brand.background}
                />
              </View>
            ) : null}
          </View>
          {court.photoAttributions && court.photoAttributions.length > 0 ? (
            <View style={styles.credits}>
              {court.photoAttributions.map((credit) => (
                <PhotoCredit
                  key={`${credit.displayName}|${credit.uri ?? ''}`}
                  name={credit.displayName}
                  uri={credit.uri}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

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
              {court.verified ? <BrandIcon name="verified" color={Brand.lime} size={16} /> : null}
            </View>
            <MetaLine
              icon="location"
              parts={[copy.distance(court.distanceMiles), court.neighborhood ?? '']}
            />
          </View>
          {court.courtCount !== undefined || court.note ? (
            <View style={styles.countBlock}>
              {court.courtCount !== undefined ? (
                <Chip
                  compact
                  label={
                    indoor ? copy.indoorCount(court.courtCount) : copy.courtCount(court.courtCount)
                  }
                  color={badge.fg}
                  background={badge.bg}
                />
              ) : null}
              {court.note ? (
                <Text style={[styles.note, { color: noteColor }]}>{court.note}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {court.description ? <Text style={styles.description}>{court.description}</Text> : null}

        {court.tags.length > 0 ? (
          <View style={styles.tags}>
            {court.tags.map((tag) => (
              <Chip
                key={tag.label}
                label={tag.label}
                icon={tag.icon}
                color={TAG_COLORS[tag.tone ?? 'default']}
              />
            ))}
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <ActionButton
          icon="directions"
          label={
            court.primaryAction ? copy.directions : copy.directionsWithDistance(court.distanceMiles)
          }
          a11yLabel={copy.a11y.directions(court.name)}
          background={Brand.chip}
          color={Brand.text}
          onPress={openDirections}
          disabledHint={copy.a11y.noLocation}
        />
        {court.primaryAction ? (
          <ActionButton
            icon={booking ? 'calendar' : 'check'}
            label={booking ? copy.bookCourt : copy.checkIn}
            a11yLabel={booking ? copy.a11y.bookCourt(court.name) : copy.a11y.checkIn(court.name)}
            background={accent}
            color={indoor ? Brand.onIndoor : Brand.onLime}
            onPress={onPrimaryAction}
          />
        ) : null}
      </View>
    </View>
  );
}

// Google's required credit for a Places photo: "Photo: <author>", a link to
// the author's page when Google gives one.
function PhotoCredit({ name, uri }: { name: string; uri: string | null }) {
  const label = copy.photoCredit(name);
  if (!uri) return <Text style={styles.credit}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      // A failed open leaves the user on the card, like Directions.
      onPress={() => Linking.openURL(uri).catch(() => undefined)}>
      <Text style={[styles.credit, styles.creditLink]}>{label}</Text>
    </Pressable>
  );
}

type ActionButtonProps = {
  icon: BrandIconName;
  label: string;
  /** Names the court, since every card has the same button labels. */
  a11yLabel: string;
  background: string;
  color: string;
  onPress?: () => void;
  /** Read out when `onPress` is omitted and the button is disabled. */
  disabledHint?: string;
};

function ActionButton({
  icon,
  label,
  a11yLabel,
  background,
  color,
  onPress,
  disabledHint = copy.a11y.comingSoon,
}: ActionButtonProps) {
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={disabled ? disabledHint : undefined}
      accessibilityState={{ disabled }}
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
  countBlock: {
    alignItems: 'flex-end',
  },
  note: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 20,
  },
  photoBlock: {
    gap: Spacing.one,
  },
  credits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  credit: {
    fontFamily: BrandFonts.body,
    fontSize: 11,
    lineHeight: 14,
    color: Brand.textMuted,
  },
  creditLink: {
    textDecorationLine: 'underline',
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
