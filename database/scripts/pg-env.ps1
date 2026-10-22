# Shared helpers for backup/restore scripts.
# Never logs or echoes passwords. Loads credentials from DATABASE_URL or PGPASSWORD.

$ErrorActionPreference = 'Stop'

function Get-PulsePlayPgBin {
  $candidates = @(
    $env:PULSEPLAY_PG_BIN,
    'C:\Program Files\PostgreSQL\18\bin',
    'C:\Program Files\PostgreSQL\16\bin'
  ) | Where-Object { $_ }
  foreach ($dir in $candidates) {
    if (Test-Path (Join-Path $dir 'pg_dump.exe')) { return $dir }
  }
  throw 'PostgreSQL bin not found. Set PULSEPLAY_PG_BIN to the folder that contains pg_dump.exe.'
}

function Read-DatabaseUrl {
  param([string]$Name = 'DATABASE_URL')
  if ($env:DATABASE_URL -and $Name -eq 'DATABASE_URL') { return $env:DATABASE_URL.Trim().Trim('"').Trim("'") }
  if ($Name -ne 'DATABASE_URL') {
    $named = [Environment]::GetEnvironmentVariable($Name)
    if ($named) { return $named.Trim().Trim('"').Trim("'") }
  }
  $envFile = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'server\.env'
  if (-not (Test-Path $envFile)) { throw "Missing $Name and server/.env" }
  $line = Get-Content $envFile | Where-Object { $_ -match ("^\s*" + [regex]::Escape($Name) + "\s*=") } | Select-Object -First 1
  if (-not $line -and $Name -eq 'DATABASE_URL') {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  }
  if (-not $line) { throw "$Name is not set" }
  return ($line -replace ("^\s*" + [regex]::Escape($Name) + "\s*="), '').Trim().Trim('"').Trim("'")
}

function Parse-DatabaseUrl {
  param([Parameter(Mandatory)][string]$Url)
  if ($Url -notmatch '^(?<scheme>postgres(?:ql)?):\/\/(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^:\/]+):(?<port>\d+)\/(?<db>[^?]+)') {
    throw 'DATABASE_URL must look like postgresql://user:***@host:port/database'
  }
  return [pscustomobject]@{
    User = $Matches.user
    Password = $Matches.pass
    Host = $Matches.host
    Port = $Matches.port
    Database = $Matches.db
  }
}

function Use-PgEnv {
  param([Parameter(Mandatory)]$Parsed)
  $env:PGPASSWORD = $Parsed.Password
  $env:PGUSER = $Parsed.User
  $env:PGHOST = $Parsed.Host
  $env:PGPORT = $Parsed.Port
}

function Clear-PgEnv {
  Remove-Item Env:PGPASSWORD, Env:PGUSER, Env:PGHOST, Env:PGPORT -ErrorAction SilentlyContinue
}

function Assert-SafeRestoreTarget {
  param([Parameter(Mandatory)][string]$Database)
  $forbidden = @('pulseplay', 'postgres', 'template0', 'template1')
  if ($forbidden -contains $Database.ToLowerInvariant()) {
    throw "Refusing to restore into protected database '$Database'. Use an isolated name such as pulseplay_backup_test."
  }
  if ($Database -notmatch '^(pulseplay_backup_test|pulseplay_.+_test)$') {
    throw "Refusing restore target '$Database'. Allowed pattern: pulseplay_backup_test or pulseplay_*_test."
  }
}
