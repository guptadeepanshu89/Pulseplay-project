import { z } from 'zod';

// Field rules shared by every module that accepts a person's details, so an
// email or mobile number means the same thing whether it arrives through
// "create user", "create client" or the create-superadmin CLI.

export const nameSchema = z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters');

// Stored lower-case: login looks accounts up by the lower-cased identifier.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254, 'Email must be at most 254 characters'));

export const mobileSchema = z.string().trim().regex(/^\d{10}$/, 'Mobile must be exactly 10 digits');
