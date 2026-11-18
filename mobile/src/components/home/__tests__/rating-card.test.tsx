import { render, screen } from '@testing-library/react-native';

import { RatingCard } from '@/components/home/rating-card';
import { en } from '@/i18n/en';

const copy = en.home.rating;

describe('RatingCard', () => {
  it('shows the rating', () => {
    render(<RatingCard rating={1512.4} />);

    expect(screen.getByText('1512.40')).toBeOnTheScreen();
    expect(screen.queryByText(copy.calibrating)).toBeNull();
  });

  it('labels the rating as myRating’s own, never as DUPR (#116)', () => {
    render(<RatingCard rating={1512.4} />);

    expect(screen.getByText(copy.unit)).toBeOnTheScreen();
    expect(screen.queryByText(/DUPR/)).toBeNull();
  });

  it('shows the calibrating state when there is no rating yet', () => {
    render(<RatingCard rating={null} />);

    expect(screen.getByText(copy.unranked)).toBeOnTheScreen();
    expect(screen.getByText(copy.calibrating)).toBeOnTheScreen();
  });

  it('shows a neutral placeholder, not calibrating, when the rating failed to load', () => {
    render(<RatingCard rating={undefined} />);

    expect(screen.getByText(copy.unavailable)).toBeOnTheScreen();
    expect(screen.queryByText(copy.unranked)).toBeNull();
    expect(screen.queryByText(copy.calibrating)).toBeNull();
  });
});
