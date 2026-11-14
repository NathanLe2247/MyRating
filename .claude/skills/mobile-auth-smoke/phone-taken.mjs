// Whether a sign-up alert means the test phone number already belongs to an
// account, so the smoke should retry with another number. Clerk has used both
// "... already has an account" and "That phone number is taken ...".
export const isPhoneTaken = (alert) => /already has an account|is taken/i.test(alert ?? '');
