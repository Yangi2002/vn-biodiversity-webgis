param(
  [string]$Output = "D:\Duong\db-backup\vnsc-data-replace-$(Get-Date -Format yyyy-MM-dd).sql",
  [string]$DatabaseUrl = "postgresql://postgres:123@localhost:5432/vn-biodiversity-webgis-DB",
  [string]$PgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PgDump)) {
  throw "pg_dump.exe not found: $PgDump"
}

$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$tables = @(
  "public.animal_db_vn",
  "public.plant_db_vn",
  "public.insect_db_vn",
  "public.fungi_db_vn",
  "public.species_images",
  "public.species_showpic_metadata",
  "public.species_taxonomy",
  "public.taxa",
  "public.taxon_names",
  "public.taxon_closure",
  "public.gbif_taxonomy_cache",
  "public.gbif_occurrences",
  "public.species_conservation_terms",
  "public.species_keyword_links",
  "public.species_gbif_occurrence_matches",
  "public.vnredlist_profiles",
  "public.species_vnredlist_matches"
)

$dumpArgs = @(
  "--data-only",
  "--disable-triggers",
  "--file=$Output"
)

foreach ($table in $tables) {
  $dumpArgs += "--table=$table"
}

$dumpArgs += $DatabaseUrl

Write-Host "Exporting species data to $Output"
& $PgDump @dumpArgs

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$requiredTables = @(
  "animal_db_vn",
  "plant_db_vn",
  "insect_db_vn",
  "fungi_db_vn",
  "species_showpic_metadata",
  "species_taxonomy",
  "taxa",
  "taxon_names",
  "taxon_closure",
  "gbif_taxonomy_cache",
  "gbif_occurrences",
  "vnredlist_profiles",
  "species_vnredlist_matches"
)

$dataTableMatches = Select-String `
  -Path $Output `
  -Pattern "^(COPY|INSERT INTO) public\.[A-Za-z0-9_]+" |
  ForEach-Object {
    if ($_.Line -match "public\.([A-Za-z0-9_]+)") {
      $Matches[1]
    }
  } |
  Sort-Object -Unique

foreach ($table in $requiredTables) {
  if ($dataTableMatches -notcontains $table) {
    throw "Export finished but required data block is missing: public.$table"
  }
}

Write-Host "Export OK: required species/taxonomy/redlist/showpic tables are present."
