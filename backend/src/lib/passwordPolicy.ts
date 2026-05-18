/**
 * Shared password strength policy used by registration, password-reset, and
 * welcome (set-password) flows. Keeping these in one place avoids the drift
 * where /reset-password used to require only uppercase + digit and
 * /set-password required only length.
 */
import { z } from "zod";

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const STRONG_PASSWORD_MESSAGE =
  "Password must include uppercase, lowercase, number, and symbol characters";

/**
 * Zod schema fragment for a single strong-password field.
 * Use as: `password: strongPassword()`.
 */
export function strongPassword() {
  return z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MESSAGE);
}

export function isStrongPassword(value: string): boolean {
  return STRONG_PASSWORD_REGEX.test(value);
}
