import { Platform } from 'react-native';

import { courtDirectionsUrl } from '@/utils/maps';

const point = { lat: 40, lng: -75 };

describe('courtDirectionsUrl', () => {
  it('opens Apple Maps on iOS, labelled with the court name', () => {
    expect(courtDirectionsUrl(point, 'Test Park', 'ios')).toBe(
      'https://maps.apple.com/?ll=40,-75&q=Test%20Park',
    );
  });

  it('opens Google Maps at the coordinates on Android and web', () => {
    const google = 'https://www.google.com/maps/search/?api=1&query=40,-75';
    expect(courtDirectionsUrl(point, 'Test Park', 'android')).toBe(google);
    expect(courtDirectionsUrl(point, 'Test Park', 'web')).toBe(google);
  });

  it('encodes characters in the name that would break the query string', () => {
    const url = courtDirectionsUrl(point, 'A & B Courts #2 / 50%?', 'ios');
    expect(url).toBe(
      'https://maps.apple.com/?ll=40,-75&q=A%20%26%20B%20Courts%20%232%20%2F%2050%25%3F',
    );
    expect(new URL(url).searchParams.get('q')).toBe('A & B Courts #2 / 50%?');
  });

  it('defaults to the running platform', () => {
    const original = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });
      expect(courtDirectionsUrl(point, 'Test Park')).toMatch(/^https:\/\/maps\.apple\.com\//);
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });
      expect(courtDirectionsUrl(point, 'Test Park')).toMatch(/^https:\/\/www\.google\.com\/maps\//);
    } finally {
      Object.defineProperty(Platform, 'OS', {
        get: () => original,
        configurable: true,
      });
    }
  });
});
