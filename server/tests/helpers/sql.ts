import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

// Runs a multi-statement script through `prisma db execute` (simple protocol,
// whole script in one go — what $executeRaw can't do).
export function runSql(url: string, sql: string): void {
  const file = join(mkdtempSync(join(tmpdir(), 'pulseplay-sql-')), 'script.sql');
  writeFileSync(file, sql);
  execSync(`npx prisma db execute --url "${url}" --file "${file}"`, { cwd: process.cwd(), stdio: 'pipe' });
}

export function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function migrationSql(names: string[]): string {
  return names.map((name) => readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')).join('\n');
}

// `prisma migrate diff --exit-code`: 0 = database matches schema.prisma, 2 = drift.
// DATABASE_URL is overridden too: schema.prisma's own datasource carries a
// `schema=` name, and comparing schema A against a datamodel that points at
// schema B reports the whole database as drift.
export function schemaMatchesDatabase(url: string): boolean {
  try {
    execSync(`npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --exit-code`, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 2) return false;
    throw error;
  }
}
