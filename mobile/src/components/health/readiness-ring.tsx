import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ReadinessMaxScore } from '@/constants/health';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

import { healthStyles } from './styles';

type ReadinessRingProps = {
  /** 0–100, or null for the empty ring. */
  score: number | null;
  value: string;
  label?: string;
};

const SIZE = BrandSizes.readinessRing;
const STROKE = BrandSizes.readinessRingStroke;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Circular progress ring with the score and zone in the middle.
export function ReadinessRing({ score, value, label }: ReadinessRingProps) {
  const progress = score === null ? 0 : Math.min(Math.max(score / ReadinessMaxScore, 0), 1);
  return (
    <View style={styles.ring}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={Brand.chip}
          strokeWidth={STROKE}
          fill="none"
        />
        {progress > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={Brand.lime}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
            fill="none"
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.value}>{value}</Text>
        {label ? <Text style={[healthStyles.chipLabel, styles.label]}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    // Start the arc at 12 o'clock.
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    alignItems: 'center',
  },
  value: {
    fontFamily: BrandFonts.display,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.32,
    color: Brand.text,
  },
  label: {
    marginTop: Spacing.one,
    letterSpacing: 1.3,
  },
});
