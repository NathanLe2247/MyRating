import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { Readiness } from '@/types/health';
import { formatDuration } from '@/utils/health-format';

import { ReadinessRing } from './readiness-ring';
import { healthStyles } from './styles';

type ReadinessCardProps = {
  /** null when there's no readiness yet: shows the empty ring and a message. */
  readiness: Readiness | null;
  /** Whether a wearable is connected; picks the empty-state message. */
  connected: boolean;
};

// Hero card: readiness ring, HRV / resting HR / sleep pillars, and a verdict.
export function ReadinessCard({ readiness, connected }: ReadinessCardProps) {
  const copy = en.health.readiness;
  return (
    <View style={healthStyles.card}>
      <View style={styles.glow} />
      <View style={healthStyles.rowBetween}>
        <View style={healthStyles.rowTight}>
          <BrandIcon name="hrv" color={Brand.lime} size={14} />
          <Text style={[healthStyles.eyebrow, styles.tag]}>{copy.tag}</Text>
        </View>
        {readiness && (
          <View style={healthStyles.chip}>
            <Text style={healthStyles.chipLabel}>{copy.modes[readiness.zone]}</Text>
          </View>
        )}
      </View>

      <View style={styles.lockup}>
        <ReadinessRing
          score={readiness?.score ?? null}
          value={readiness ? en.health.units.percent(Math.round(readiness.score)) : copy.empty}
          label={readiness ? copy.zones[readiness.zone] : undefined}
        />
        {readiness ? (
          <View style={styles.pillars}>
            <Pillar icon="hrv" label={copy.hrv}>
              <Text style={styles.metric}>{readiness.hrvMs}</Text>
              <Text style={[healthStyles.caption, styles.unitAccent]}>{en.health.units.ms}</Text>
            </Pillar>
            <Pillar icon="heart" label={copy.restingHr}>
              <Text style={styles.metric}>{readiness.restingHeartRate}</Text>
              <Text style={healthStyles.caption}>{en.health.units.bpm}</Text>
            </Pillar>
            <Pillar icon="sleep" label={copy.sleep}>
              <Text style={styles.metric}>{formatDuration(readiness.sleepMinutes)}</Text>
              <Text style={healthStyles.chipLabel}>
                {en.health.units.percent(Math.round(readiness.sleepEfficiency))}
              </Text>
            </Pillar>
          </View>
        ) : (
          <View style={styles.emptyText}>
            <Text style={healthStyles.heading}>{copy.emptyTitle}</Text>
            <Text style={healthStyles.caption}>
              {connected ? copy.pendingBody : copy.emptyBody}
            </Text>
          </View>
        )}
      </View>

      {readiness && (
        <View style={[healthStyles.inset, styles.verdict]}>
          <BrandIcon name="bolt" color={Brand.lime} size={14} />
          <Text style={styles.verdictText}>{copy.verdicts[readiness.zone]}</Text>
        </View>
      )}
    </View>
  );
}

type PillarProps = {
  icon: BrandIconName;
  label: string;
  children: React.ReactNode;
};

function Pillar({ icon, label, children }: PillarProps) {
  return (
    <View style={[healthStyles.inset, healthStyles.rowBetween, styles.pillar]}>
      <View style={[healthStyles.rowTight, styles.pillarLabel]}>
        <BrandIcon name={icon} color={Brand.textMuted} size={13} />
        <Text style={healthStyles.caption} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.pillarValue}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -Spacing.five,
    right: -Spacing.five,
    width: BrandSizes.readinessGlow,
    height: BrandSizes.readinessGlow,
    experimental_backgroundImage: `radial-gradient(circle, ${Brand.limeSurface} 0%, transparent 70%)`,
  },
  tag: {
    color: Brand.lime,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  pillars: {
    flex: 1,
    gap: Spacing.two,
  },
  pillar: {
    paddingHorizontal: Spacing.two,
    paddingVertical: BrandSizes.gapTight,
  },
  pillarLabel: {
    flexShrink: 1,
  },
  pillarValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  metric: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: 0.44,
    color: Brand.text,
  },
  unitAccent: {
    fontFamily: BrandFonts.bodySemiBold,
    color: Brand.lime,
  },
  emptyText: {
    flex: 1,
    gap: Spacing.one,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two,
    marginTop: Spacing.three,
  },
  verdictText: {
    flex: 1,
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16.5,
    letterSpacing: 0.12,
    color: Brand.text,
  },
});
