/**
 * @jest-environment jsdom
 */
// Issue #66: on web, SegmentedControl must expose its selection as ARIA.
// Renders it through react-native-web (what the Expo web build uses) and
// checks the DOM a screen reader would see.
import { act } from 'react';
import { AppRegistry } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';

jest.mock('react-native', () => jest.requireActual('react-native-web'));

const options = ['left', 'right'] as const;
const labels = { left: 'Left', right: 'Right' };
const noop = () => {};

function Controls() {
  return (
    <>
      <SegmentedControl options={options} labels={labels} value="left" onChange={noop} />
      <SegmentedControl options={options} labels={labels} value="right" onChange={noop} variant="tabs" />
    </>
  );
}

function renderWeb() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // react-native-web's AppRegistry mounts into a real DOM node, like the web build.
  AppRegistry.registerComponent('SegmentedControls', () => Controls);
  act(() => {
    AppRegistry.runApplication('SegmentedControls', { rootTag: container });
  });
  return container;
}

describe('SegmentedControl on web', () => {
  it('exposes radio selection as aria-checked and tab selection as aria-selected', () => {
    const container = renderWeb();

    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios).toHaveLength(2);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });
});
