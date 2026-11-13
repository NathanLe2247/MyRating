/**
 * @jest-environment jsdom
 */
// Issue #62: on web, the rating option cards must expose their state as ARIA.
// Renders RatingOptionCard through react-native-web (what the Expo web build
// uses) and checks the DOM a screen reader would see.
import { act } from 'react';
import { AppRegistry } from 'react-native';

import { RatingOptionCard } from '@/components/onboarding/rating-option-card';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
// expo-symbols is a native module; the icon is irrelevant to the ARIA state.
jest.mock('@/components/brand-icon', () => ({ BrandIcon: () => null }));

const noop = () => {};

function Cards() {
  return (
    <>
      <RatingOptionCard icon="key" iconColor="#fff" title="Calibrate" subtitle="s" body="b" selected onPress={noop} />
      <RatingOptionCard icon="key" iconColor="#fff" title="Self rate" subtitle="s" body="b" selected={false} onPress={noop} />
      <RatingOptionCard
        icon="key"
        iconColor="#fff"
        title="DUPR"
        subtitle="s"
        body="b"
        selected={false}
        onPress={noop}
        disabledLabel="Soon"
      />
    </>
  );
}

function renderWebRadios() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // react-native-web's AppRegistry mounts into a real DOM node, like the web build.
  AppRegistry.registerComponent('RatingOptionCards', () => Cards);
  act(() => {
    AppRegistry.runApplication('RatingOptionCards', { rootTag: container });
  });
  return Array.from(container.querySelectorAll('[role="radio"]'));
}

describe('RatingOptionCard on web', () => {
  it('exposes selection and disabled state as ARIA attributes', () => {
    const radios = renderWebRadios();
    expect(radios).toHaveLength(3);
    const [selected, unselected, disabled] = radios;

    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(unselected.getAttribute('aria-checked')).toBe('false');
    expect(disabled.getAttribute('aria-checked')).toBe('false');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
  });
});
