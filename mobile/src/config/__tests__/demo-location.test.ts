import { parseDemoLocation } from '@/config/demo-location';

describe('parseDemoLocation', () => {
  it('parses valid coordinates', () => {
    expect(parseDemoLocation('39.1022', '-76.9441')).toEqual({ lat: 39.1022, lng: -76.9441 });
  });

  it('is unset unless both values are present', () => {
    expect(parseDemoLocation(undefined, undefined)).toBeUndefined();
    expect(parseDemoLocation('39.1022', undefined)).toBeUndefined();
    expect(parseDemoLocation('', '-76.9441')).toBeUndefined();
    expect(parseDemoLocation('  ', '-76.9441')).toBeUndefined();
  });

  it('ignores values that are not coordinates', () => {
    expect(parseDemoLocation('abc', '-76.9441')).toBeUndefined();
    expect(parseDemoLocation('91', '0')).toBeUndefined();
    expect(parseDemoLocation('0', '-181')).toBeUndefined();
  });
});

// `demoLocation()` itself isn't tested by changing `process.env`: Expo's Babel
// preset inlines `process.env.EXPO_PUBLIC_*` when the file is transformed, so
// runtime changes never reach it. useNearbyCourts' tests mock it instead.
