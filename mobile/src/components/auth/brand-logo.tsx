import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Brand } from '@/constants/theme';

const SIZE = 80;
const C = SIZE / 2;

// Pickleball-in-a-ring mark: a lime ball with holes, a dashed "court" ring,
// and a paddle handle breaking out at the top right.
const HOLES = [
  [C - 5, C - 5],
  [C + 5, C - 5],
  [C, C],
  [C - 5, C + 5],
  [C + 5, C + 5],
] as const;

// `size` scales the whole mark (drawn on an 80×80 viewBox).
export function BrandLogo({ size = SIZE }: { size?: number }) {
  return (
    <View style={[styles.glow, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={C} cy={C} r={C} fill={Brand.logoRing} />
        <Circle
          cx={C}
          cy={C}
          r={24}
          fill="none"
          stroke={Brand.lime}
          strokeOpacity={0.55}
          strokeWidth={2.5}
          strokeDasharray="5 3"
        />
        <Circle cx={C} cy={C} r={16} fill={Brand.lime} />
        {HOLES.map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} fill={Brand.onLime} />
        ))}
        <Line
          x1={C + 13}
          y1={C - 13}
          x2={C + 21}
          y2={C - 21}
          stroke={Brand.lime}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    boxShadow: `0 0 36px ${Brand.limeGlow}`,
  },
});
