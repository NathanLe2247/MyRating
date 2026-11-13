import { formatNationalNumber, isValidUsNumber, toUsE164 } from '@/constants/phone';

describe('isValidUsNumber', () => {
  it('accepts a NANP number', () => {
    expect(isValidUsNumber('5125550134')).toBe(true);
  });

  it.each([
    ['0125550134', 'area code starts with 0'],
    ['1125550134', 'area code starts with 1'],
    ['9115550134', 'N11 area code'],
    ['5121550134', 'exchange starts with 1'],
    ['512555013', 'too short'],
    ['51255501345', 'too long'],
  ])('rejects %s (%s)', (digits) => {
    expect(isValidUsNumber(digits)).toBe(false);
  });
});

describe('formatNationalNumber', () => {
  it.each([
    ['', ''],
    ['5', '(5'],
    ['512', '(512'],
    ['5125', '(512) 5'],
    ['512555', '(512) 555'],
    ['5125550', '(512) 555-0'],
    ['5125550134', '(512) 555-0134'],
    ['512555013499', '(512) 555-0134'],
  ])('formats %p as %p', (digits, expected) => {
    expect(formatNationalNumber(digits)).toBe(expected);
  });
});

describe('toUsE164', () => {
  it.each([
    '5125550134',
    '(512) 555-0134',
    '512.555.0134',
    '+1 512 555 0134',
    '15125550134',
    '  512-555-0134  ',
  ])('normalizes %p', (input) => {
    expect(toUsE164(input)).toBe('+15125550134');
  });

  it.each(['player@example.com', 'nathan', '911', '+44 20 7946 0958', ''])(
    'returns null for non-US-phone input %p',
    (input) => {
      expect(toUsE164(input)).toBeNull();
    },
  );
});
