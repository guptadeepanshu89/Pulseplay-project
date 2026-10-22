# Restore a local custom-format dump into an isolated test database.
# NEVER restores into pulseplay / postgres.
#
# Prerequisites: the target database must already exist and be empty (or you accept
# pg_restore errors on existing objects — this script does not DROP databases).
#
# Usage:
#   powershell -File database/scripts/restore.ps1 -TargetDatabase pulseplay_backup_test
#   powershell -File database/scripts/restore.ps1 -TargetDatabase pulseplay_backup_test -DumpFile database/local/pulseplay_YYYYMMDD-HHMMSS.dump

param(
  [Parameter(Mandatory)][string]$TargetDatabase,
  [string]$DumpFile = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'pg-env.ps1')

Assert-SafeRestoreTarget -Database $TargetDatabase

$bin = Get-PulsePlayPgBin
$psql = Join-Path $bin 'psql.exe'
$pgRestore = Join-Path $bin 'pg_restore.exe'
$parsed = Parse-DatabaseUrl (Read-DatabaseUrl)
$localDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'local'

if (-not $DumpFile) {
  $last = Join-Path $localDir '.last_backup_name'
  if (-not (Test-Path $last)) { throw 'No DumpFile given and database/local/.last_backup_name is missing. Run backup.ps1 first.' }
  $DumpFile = Join-Path $localDir (Get-Content $last -Raw).Trim()
}
if (-not (Test-Path $DumpFile)) { throw "Dump file not found: $DumpFile" }

Write-Host "Restoring dump='$DumpFile' into target='$TargetDatabase' (source app DB='$($parsed.Database)' stays untouched)"
Use-PgEnv $parsed
try {
  $exists = (& $psql -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='$TargetDatabase');").Trim()
  if ($exists -ne 't') {
    throw "Target database '$TargetDatabase' does not exist. Create it first as a superuser, e.g.: CREATE DATABASE pulseplay_backup_test OWNER pulseplay;"
  }
  $orig = (& $psql -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='$($parsed.Database)');").Trim()
  if ($orig -ne 't') { throw "Refusing to continue: original database '$($parsed.Database)' is missing." }

  # Refuse non-empty public schema to avoid silent overwrite of prior restore data
  $tableCount = (& $psql -d $TargetDatabase -v ON_ERROR_STOP=1 -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';").Trim()
  if ([int]$tableCount -gt 0) {
    throw "Target '$TargetDatabase' already has $tableCount public tables. This script will not overwrite. Drop objects manually or use a fresh empty database."
  }

  & $pgRestore -d $TargetDatabase --no-owner --no-acl --exit-on-error $DumpFile
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit $LASTEXITCODE" }
} finally {
  Clear-PgEnv
}

Write-Host "OK restore completed into $TargetDatabase"
exit 0
