import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { CourtLoad, CourtLoadDay } from '@/types/health';
import { formatDuration, weekdayInitial } from '@/utils/health-format';

import { healthStyles } from './styles';

type CourtLoadCardProps = {
  load: CourtLoad;
};

// Past-7-days court time as a bar chart, with weekly totals underneath.
export function CourtLoadCard({ load }: CourtLoadCardProps) {
  const copy = en.health.courtLoad;
  const peak = Math.max(0, ...load.days.map((d) => d.courtMinutes));
  const totalMinutes = load.days.reduce((sum, d) => sum + d.courtMinutes, 0);

  return (
    <View style={healthStyles.card}>
      <View style={healthStyles.rowBetween}>
        <View>
          <Text style={healthStyles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={healthStyles.heading}>{copy.title}</Text>
        </View>
        <View style={[healthStyles.chip, healthStyles.rowTight, styles.kcal]}>
          <BrandIcon name="flame" color={Brand.lime} size={12} />
          <Text style={styles.kcalValue}>{load.kcalPerMatch}</Text>
          <Text style={healthStyles.caption}>{copy.kcalPerMatch}</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {load.days.map((day, i) => (
          <Bar
            key={day.date}
            day={day}
            peak={peak}
            isToday={i === load.days.length - 1}
          />
        ))}
      </View>

      <View style={styles.summary}>
        <Summary label={copy.totalTime} value={formatDuration(totalMinutes)} />
        <Summary label={copy.matchesLogged} value={copy.matches(load.matchesLogged)} />
        <Summary label={copy.avgHeartRate} value={copy.bpm(load.avgHeartRate)} accent />
      </View>
    </View>
  );
}

type BarProps = {
  day: CourtLoadDay;
  peak: number;
  isToday: boolean;
};

function Bar({ day, peak, isToday }: BarProps) {
  const isPeak = !isToday && peak > 0 && day.courtMinutes === peak;
  const rest = day.courtMinutes === 0;
  const fill = isToday ? Brand.cyan : isPeak ? Brand.lime : Brand.chip;
  const valueColor = isToday ? Brand.cyan : isPeak ? Brand.lime : Brand.textMuted;
  const dayColor = isToday ? Brand.cyan : isPeak ? Brand.text : Brand.textMuted;
  const height = rest || peak === 0 ? undefined : `${(day.courtMinutes / peak) * 100}%` as const;

  return (
    <View style={styles.column}>
      <Text style={[styles.barValue, { color: valueColor }]}>
        {formatDuration(day.courtMinutes)}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.bar,
            height ? { height } : styles.restBar,
            { backgroundColor: fill },
            isPeak && styles.peakGlow,
          ]}
        />
      </View>
      <Text style={[healthStyles.chipLabel, { color: dayColor }]}>
        {isToday ? en.health.courtLoad.today : weekdayInitial(day.date)}
      </Text>
    </View>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[healthStyles.inset, styles.summaryCell]}>
      <Text style={[healthStyles.caption, styles.center]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[healthStyles.heading, styles.center, accent && styles.accent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kcal: {
    paddingVertical: Spacing.one,
  },
  kcalValue: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 22,
    color: Brand.text,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
    height: BrandSizes.courtChart,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  barValue: {
    fontFamily: BrandFonts.body,
    fontSize: 10,
    lineHeight: 14,
  },
  track: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: BrandSizes.pillRadius,
  },
  restBar: {
    height: Spacing.two,
  },
  peakGlow: {
    boxShadow: `0 0 12px ${Brand.limeGlow}`,
  },
  summary: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  center: {
    textAlign: 'center',
  },
  accent: {
    color: Brand.lime,
  },
});
