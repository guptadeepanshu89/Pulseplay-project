# Read-only integrity comparison between the source DB (DATABASE_URL) and a restore target.
# Usage:
#   powershell -File database/scripts/verify.ps1 -TargetDatabase pulseplay_backup_test

param(
  [Parameter(Mandatory)][string]$TargetDatabase,
  [string]$SourceDatabase = '',
  # PriceHistory is append-only and the live cryptoFeed keeps writing after a dump.
  # By default a higher source count is reported as live drift, not a restore failure.
  [switch]$StrictPriceHistory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'pg-env.ps1')

Assert-SafeRestoreTarget -Database $TargetDatabase

$bin = Get-PulsePlayPgBin
$psql = Join-Path $bin 'psql.exe'
$parsed = Parse-DatabaseUrl (Read-DatabaseUrl)
$source = if ($SourceDatabase) { $SourceDatabase } else { $parsed.Database }

$tables = @(
  'User', 'Client', 'Event', 'Market', 'MarketSelection', 'Bet', 'BetSelectionLeg',
  'Wallet', 'WalletTransaction', 'WalletLedger', 'WalletRequest', 'Notification',
  'PriceHistory', 'Lookup', 'Role', 'PasswordResetToken'
)

function Invoke-Sql {
  param([string]$Database, [string]$Sql)
  # Pipe SQL on stdin so Windows does not strip double-quoted identifiers.
  $raw = $Sql | & $psql -d $Database -v ON_ERROR_STOP=1 -tA
  if ($LASTEXITCODE -ne 0) { throw "psql failed on database=$Database" }
  return ([string]$raw).Trim()
}

Use-PgEnv $parsed
$failed = 0
try {
  Write-Host "Comparing source='$source' vs target='$TargetDatabase'"

  $srcTables = Invoke-Sql $source "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
  $tgtTables = Invoke-Sql $TargetDatabase "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
  Write-Host "public_base_tables source=$srcTables target=$tgtTables"
  if ($srcTables -ne $tgtTables) {
    Write-Host 'MISMATCH table count'
    $failed++
  }

  Write-Host '--- row counts ---'
  foreach ($table in $tables) {
    $existsSql = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table');"
    $existsSrc = Invoke-Sql $source $existsSql
    $existsTgt = Invoke-Sql $TargetDatabase $existsSql
    if ($existsSrc -ne 't') {
      Write-Host "SKIP $table (missing on source)"
      continue
    }
    if ($existsTgt -ne 't') {
      Write-Host "MISSING $table on target"
      $failed++
      continue
    }
    $countSql = 'SELECT count(*) FROM "' + $table + '";'
    $sc = Invoke-Sql $source $countSql
    $tc = Invoke-Sql $TargetDatabase $countSql
    if ($sc -eq $tc) {
      $ok = 'OK'
    } elseif ($table -eq 'PriceHistory' -and -not $StrictPriceHistory -and [int]$sc -ge [int]$tc) {
      $ok = 'LIVE_DRIFT'
      Write-Host ("NOTE: PriceHistory grew on source after the dump (cryptoFeed). Restore still holds {0} rows." -f $tc)
    } else {
      $ok = 'DIFF'
      $failed++
    }
    Write-Host ("{0,-22} source={1,-8} target={2,-8} {3}" -f $table, $sc, $tc, $ok)
  }

  Write-Host '--- foreign key orphans (target) ---'
  $orphanChecks = @(
    @{ Name = 'Bet.userId'; Sql = 'SELECT count(*) FROM "Bet" b LEFT JOIN "User" u ON u.id = b."userId" WHERE u.id IS NULL;' },
    @{ Name = 'Market.eventId'; Sql = 'SELECT count(*) FROM "Market" m LEFT JOIN "Event" e ON e.id = m."eventId" WHERE e.id IS NULL;' },
    @{ Name = 'MarketSelection.marketId'; Sql = 'SELECT count(*) FROM "MarketSelection" s LEFT JOIN "Market" m ON m.id = s."marketId" WHERE m.id IS NULL;' },
    @{ Name = 'BetSelectionLeg.betId'; Sql = 'SELECT count(*) FROM "BetSelectionLeg" l LEFT JOIN "Bet" b ON b.id = l."betId" WHERE b.id IS NULL;' },
    @{ Name = 'Wallet.userId'; Sql = 'SELECT count(*) FROM "Wallet" w LEFT JOIN "User" u ON u.id = w."userId" WHERE u.id IS NULL;' },
    @{ Name = 'WalletLedger.walletId'; Sql = 'SELECT count(*) FROM "WalletLedger" l LEFT JOIN "Wallet" w ON w.id = l."walletId" WHERE w.id IS NULL;' }
  )
  foreach ($c in $orphanChecks) {
    $n = Invoke-Sql $TargetDatabase $c.Sql
    if ($n -eq '0') {
      $ok = 'OK'
    } else {
      $ok = 'FAIL'
      $failed++
    }
    Write-Host ("{0,-28} orphans={1} {2}" -f $c.Name, $n, $ok)
  }

  Write-Host '--- wallet aggregates ---'
  $balSql = 'SELECT COALESCE(sum("availableBalance"),0)::text FROM "Wallet";'
  $srcBal = Invoke-Sql $source $balSql
  $tgtBal = Invoke-Sql $TargetDatabase $balSql
  if ($srcBal -eq $tgtBal) {
    $balOk = 'OK'
  } else {
    $balOk = 'DIFF'
    $failed++
  }
  Write-Host ("sum(availableBalance) source={0} target={1} {2}" -f $srcBal, $tgtBal, $balOk)

  $fkSql = "SELECT count(*) FROM pg_constraint WHERE contype = 'f';"
  $srcFk = Invoke-Sql $source $fkSql
  $tgtFk = Invoke-Sql $TargetDatabase $fkSql
  Write-Host ("fk_constraints source={0} target={1}" -f $srcFk, $tgtFk)
  if ($srcFk -ne $tgtFk) {
    Write-Host 'MISMATCH fk count'
    $failed++
  }
} finally {
  Clear-PgEnv
}

if ($failed -gt 0) {
  Write-Host "VERIFY FAILED ($failed checks)"
  exit 1
}
Write-Host 'VERIFY OK'
exit 0
