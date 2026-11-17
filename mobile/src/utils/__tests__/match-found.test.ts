import { CloseSkillMatchMaxGap } from '@/constants/match';
import { en } from '@/i18n/en';
import {
  formatElapsed,
  formatMiles,
  formatRatingImpact,
  pairingSubtitle,
  toPercent,
} from '@/utils/match-found-format';

describe('match found formatting', () => {
  it('formats queue time as mm:ss', () => {
    expect(formatElapsed(42)).toBe('00:42');
    expect(formatElapsed(754)).toBe('12:34');
    expect(formatElapsed(-3)).toBe('00:00');
  });

  it('calls only a gap within the threshold a close skill match', () => {
    const t = en.matchFound;
    expect(pairingSubtitle(1500, 1520)).toBe(t.closeMatch('20.00'));
    expect(pairingSubtitle(1500, 1500 + CloseSkillMatchMaxGap)).toBe(t.closeMatch(`${CloseSkillMatchMaxGap}.00`));
    expect(pairingSubtitle(1675.07, 1500)).toBe(t.ratingGap('175.07'));
    expect(pairingSubtitle(null, 1500)).toBe(t.parityCalibrating);
  });

  it('rounds and clamps probabilities to whole percents', () => {
    expect(toPercent(0.514)).toBe(51);
    expect(toPercent(1.2)).toBe(100);
    expect(toPercent(-0.1)).toBe(0);
  });

  it('formats impact and miles', () => {
    expect(formatRatingImpact(0.038)).toBe('0.038');
    expect(formatRatingImpact(-0.038)).toBe('0.038');
    expect(formatMiles(1.44)).toBe('1.4');
  });
});
