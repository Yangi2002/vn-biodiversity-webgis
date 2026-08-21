param(
  [string]$Output = "D:\Duong\db-backup\vnsc-data-update-$(Get-Date -Format yyyy-MM-dd).sql",
  [string]$DatabaseUrl = "postgresql://postgres:123@localhost:5432/vn-biodiversity-webgis-DB",
  [string]$PgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
  [string]$TableManifest = "$PSScriptRoot\data-update-tables.txt"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PgDump)) {
  throw "pg_dump.exe not found: $PgDump"
}

if (-not (Test-Path $TableManifest)) {
  throw "Data table manifest not found: $TableManifest"
}

$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$tables = Get-Content $TableManifest |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and -not $_.StartsWith('#') }

if (-not $tables) {
  throw "Data table manifest is empty: $TableManifest"
}

foreach ($table in $tables) {
  if ($table -notmatch '^[a-z0-9_]+$') {
    throw "Invalid table name in manifest: $table"
  }
}

$dumpArgs = @(
  "--data-only",
  "--disable-triggers",
  "--file=$Output"
)

foreach ($table in $tables) {
  $dumpArgs += "--table=public.$table"
}

$dumpArgs += $DatabaseUrl

Write-Host "Exporting species data to $Output"
& $PgDump @dumpArgs

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$dataTableMatches = Select-String `
  -Path $Output `
  -Pattern "^(COPY|INSERT INTO) public\.[A-Za-z0-9_]+" |
  ForEach-Object {
    if ($_.Line -match "public\.([A-Za-z0-9_]+)") {
      $Matches[1]
    }
  } |
  Sort-Object -Unique

foreach ($table in $tables) {
  if ($dataTableMatches -notcontains $table) {
    throw "Export finished but required data block is missing: public.$table"
  }
}

Write-Host "Export OK: all $($tables.Count) business data tables are present."
