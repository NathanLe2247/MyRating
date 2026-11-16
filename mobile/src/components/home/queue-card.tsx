import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { useElapsedSeconds } from '@/hooks/use-elapsed-seconds';
import { en } from '@/i18n/en';
import type { QueueCardStatus } from '@/types/matchmaking';
import { formatElapsed } from '@/utils/match-found-format';

type QueueCardProps = {
  /** Still playing placement matches (no rating yet). */
  calibrating: boolean;
  status: QueueCardStatus;
  /** An action is in flight: the card can't be pressed again. */
  busy?: boolean;
  /** Copy for the last failed matchmaking call. */
  error?: string;
  onFindMatch: () => void;
  onOpenMatch: () => void;
  onLeave: () => void;
};

const t = en.home.queue;

// Home's call to action for the match queue: "Find a match", then a search
// timer with Leave, then the pairing (tap to open Match Found).
export function QueueCard({
  calibrating,
  status,
  busy,
  error,
  onFindMatch,
  onOpenMatch,
  onLeave,
}: QueueCardProps) {
  const errorNote = error ? (
    <Text style={styles.error} accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  if (status.kind === 'searching') {
    return (
      <View style={styles.card}>
        <SearchingRow since={status.since} radiusMiles={status.radiusMiles} busy={busy} onLeave={onLeave} />
        {errorNote}
      </View>
    );
  }

  const content =
    status.kind === 'matched'
      ? {
          title: t.matchedTitle,
          subtitle: status.waiting ? t.waitingBody(status.opponent) : t.matchedBody(status.opponent),
          label: t.openMatch,
          onPress: onOpenMatch,
        }
      : status.kind === 'on'
        ? { title: t.onTitle, subtitle: t.onBody(status.opponent), label: t.openMatch, onPress: onOpenMatch }
        : {
            title: t.title,
            subtitle: calibrating ? t.placement : t.subtitle,
            label: t.findMatch,
            onPress: onFindMatch,
          };

  return (
    <Pressable
      onPress={content.onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={content.label}
      accessibilityHint={content.subtitle}
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.iconCircle}>
          {busy ? (
            <ActivityIndicator color={Brand.lime} />
          ) : (
            <BrandIcon name="bolt" color={Brand.lime} size={22} />
          )}
        </View>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{content.title}</Text>
            <BrandIcon name="arrowRight" color={Brand.onLime} size={20} />
          </View>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>
      </View>
      {errorNote}
    </Pressable>
  );
}

type SearchingRowProps = {
  since?: string;
  radiusMiles: number;
  busy?: boolean;
  onLeave: () => void;
};

function SearchingRow({ since, radiusMiles, busy, onLeave }: SearchingRowProps) {
  const elapsed = useElapsedSeconds(since);
  return (
    <View style={styles.top}>
      <View style={styles.iconCircle}>
        <ActivityIndicator color={Brand.lime} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {t.searchingTitle}
        </Text>
        <Text style={styles.subtitle}>{t.searching(radiusMiles)}</Text>
        <Text style={styles.subtitle}>{t.elapsed(formatElapsed(elapsed))}</Text>
      </View>
      <Pressable
        onPress={onLeave}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t.leaveLabel}
        accessibilityState={{ disabled: !!busy }}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
        <BrandIcon name="close" color={Brand.onLime} size={10} />
        <Text style={styles.leaveLabel}>{t.leave}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    backgroundColor: Brand.lime,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    overflow: 'hidden',
    experimental_backgroundImage: `linear-gradient(120deg, ${Brand.lime} 45%, ${Brand.limeHighlight} 100%)`,
    boxShadow: `0 8px 32px -8px ${Brand.limeGlow}`,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: BrandSizes.control,
    height: BrandSizes.control,
    borderRadius: BrandSizes.controlRadius,
    backgroundColor: Brand.onLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 26,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
  subtitle: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLimeMuted,
  },
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: BrandSizes.minTouch,
    paddingHorizontal: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.onLimeChip,
  },
  leaveLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
  error: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 13,
    color: Brand.onLime,
  },
});
