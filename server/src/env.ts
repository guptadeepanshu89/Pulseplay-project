import 'dotenv/config';

function required(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`Missing or too-short required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 16),
  // bcrypt work factor. 10 in production; the test suite lowers it so it isn't spent hashing.
  bcryptCost: Math.max(4, Number(process.env.BCRYPT_COST ?? 10)),
  isProduction: process.env.NODE_ENV === 'production',
};
