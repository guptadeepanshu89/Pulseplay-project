import 'dotenv/config';

// Tests run against a throwaway Postgres *schema* (`test`) in the same
// database as dev — the app's DB role owns the database, so it can drop and
// recreate schemas, but it never has to create a whole database. The dev
// data in schema `public` is never touched.
const devUrl = process.env.DATABASE_URL;
if (!devUrl) {
  throw new Error('DATABASE_URL must be set (server/.env) so the test schema can be derived from it');
}

export const TEST_DATABASE_URL = /[?&]schema=/.test(devUrl)
  ? devUrl.replace(/([?&]schema=)[^&]+/, '$1test')
  : `${devUrl}${devUrl.includes('?') ? '&' : '?'}schema=test`;

export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'test-jwt-secret-only-used-by-the-test-suite-1234',
  BCRYPT_COST: '4',
  NODE_ENV: 'test',
};
