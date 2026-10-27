import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthButton } from '@/components/auth/auth-button';

describe('AuthButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<AuthButton label="Sign in" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores taps while disabled', () => {
    const onPress = jest.fn();
    render(<AuthButton label="Sign in" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('hides the label and reports busy while loading', () => {
    const onPress = jest.fn();
    render(<AuthButton label="Sign in" onPress={onPress} loading />);

    expect(screen.queryByText('Sign in')).toBeNull();
    expect(screen.getByRole('button')).toBeBusy();

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
