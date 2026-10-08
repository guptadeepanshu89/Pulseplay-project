import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { z } from 'zod';

import { env } from '../env';

export const hashPassword = (password: string) => bcrypt.hash(password, env.bcryptCost);

// A password a user chooses: ≥ 10 chars with at least one letter and one digit.
export const newPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // no I, O, l — easy to misread
const DIGITS = '23456789'; // no 0, 1
const ALPHABET = LETTERS + DIGITS;
const TEMP_PASSWORD_LENGTH = 16;

// Server-generated temporary password (create user / reset password): shown once,
// must be changed at first login. Guaranteed to satisfy newPasswordSchema.
export function generateTempPassword(): string {
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(ALPHABET));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
