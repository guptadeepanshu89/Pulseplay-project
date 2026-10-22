# Create a custom-format (-Fc) dump of the development database into database/local/.
# Usage (from repo root):
#   powershell -File database/scripts/backup.ps1
# Optional: -DatabaseName pulseplay  (defaults to the database name in DATABASE_URL)

param(
  [string]$DatabaseName = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'pg-env.ps1')

$bin = Get-PulsePlayPgBin
$pgDump = Join-Path $bin 'pg_dump.exe'
$pgRestore = Join-Path $bin 'pg_restore.exe'
$parsed = Parse-DatabaseUrl (Read-DatabaseUrl)
$db = if ($DatabaseName) { $DatabaseName } else { $parsed.Database }

$localDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $localDir ("${db}_$stamp.dump")

Write-Host "Backing up database='$db' host='$($parsed.Host)' with $(& $pgDump --version)"
Use-PgEnv $parsed
try {
  & $pgDump -d $db -Fc --no-owner --no-acl -f $outFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit $LASTEXITCODE" }
} finally {
  Clear-PgEnv
}

$fi = Get-Item $outFile
if ($fi.Length -le 0) { throw "Backup file is empty: $outFile" }

& $pgRestore -l $outFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore -l failed; archive may be corrupt" }

Set-Content -Path (Join-Path $localDir '.last_backup_name') -Value $fi.Name
Write-Host "OK size_bytes=$($fi.Length) file=$($fi.FullName)"
exit 0
