import { Pressable, StyleSheet, Text, View } from 'react-native';

import { matchText } from '@/components/match-found/text-styles';
import { MaxStepperPoints } from '@/constants/match-results';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type ScoreStepperProps = {
  /** Shown above the score, e.g. "You" or the opponent's name. */
  label: string;
  /** Who the buttons move, in their labels ("you", the opponent's name). */
  who: string;
  points: number;
  disabled?: boolean;
  onStep: (delta: number) => void;
};

const t = en.reportResult;

// One side of a game's score: − points +.
export function ScoreStepper({ label, who, points, disabled, onStep }: ScoreStepperProps) {
  return (
    <View style={styles.side}>
      <Text style={matchText.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.row}>
        <StepButton
          symbol={t.minus}
          label={t.pointDown(who)}
          disabled={disabled || points <= 0}
          onPress={() => onStep(-1)}
        />
        <Text style={styles.points} accessibilityLabel={t.points(label, points)}>
          {points}
        </Text>
        <StepButton
          symbol={t.plus}
          label={t.pointUp(who)}
          disabled={disabled || points >= MaxStepperPoints}
          onPress={() => onStep(1)}
        />
      </View>
    </View>
  );
}

type StepButtonProps = { symbol: string; label: string; disabled: boolean; onPress: () => void };

function StepButton({ symbol, label, disabled, onPress }: StepButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, disabled && styles.stepDisabled, pressed && styles.pressed]}>
      <Text style={styles.stepSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  side: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  points: {
    minWidth: BrandSizes.minTouch,
    textAlign: 'center',
    fontFamily: BrandFonts.display,
    fontSize: 36,
    color: Brand.text,
    fontVariant: ['tabular-nums'],
  },
  step: {
    width: BrandSizes.minTouch,
    height: BrandSizes.minTouch,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.chip,
  },
  stepDisabled: {
    opacity: 0.4,
  },
  stepSymbol: {
    fontFamily: BrandFonts.display,
    fontSize: 24,
    color: Brand.lime,
  },
  pressed: {
    opacity: 0.8,
  },
});
