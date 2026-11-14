// Whether a sign-up alert means the test phone number already belongs to an
// account, so the smoke should retry with another number.
export const isPhoneTaken = (alert) => /already has an account/i.test(alert ?? '');
