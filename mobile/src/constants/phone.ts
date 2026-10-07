// Sign-up only accepts US numbers for now, so the dial code is fixed.
export const DialCode = '+1';
export const NationalNumberLength = 10;

// NANP shape check: area code and exchange can't start with 0/1, and N11
// codes (211, 411, 911…) aren't assignable area codes. Clerk does the final
// validation when it sends the SMS.
export function isValidUsNumber(digits: string): boolean {
  return /^[2-9](?!11)\d{2}[2-9]\d{6}$/.test(digits);
}

// Formats as the user types: `(555) 000-0000`.
export function formatNationalNumber(digits: string): string {
  const d = digits.slice(0, NationalNumberLength);
  if (d.length <= 3) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Characters a typed phone number may contain besides digits.
const PHONE_FORMATTING = /[\s().+-]/g;

// Returns the E.164 form (`+15125550134`) when `input` is a US phone number
// — with or without formatting or a leading `+1`/`1` — otherwise `null`, so
// a sign-in identifier can be routed to SMS instead of password.
export function toUsE164(input: string): string | null {
  const stripped = input.trim().replace(PHONE_FORMATTING, '');
  if (!/^\d+$/.test(stripped)) return null;
  const national =
    stripped.length === NationalNumberLength + 1 && stripped.startsWith('1') ? stripped.slice(1) : stripped;
  return isValidUsNumber(national) ? `${DialCode}${national}` : null;
}
