param(
  [string]$Version = "v0.1.0"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BundleRoot = Join-Path $ProjectRoot "artifacts\kaggle\s3-ai03-$Version"
$ArchivePath = "$BundleRoot.zip"

if (Test-Path -LiteralPath $BundleRoot) {
  throw "Bundle directory already exists: $BundleRoot"
}
if (Test-Path -LiteralPath $ArchivePath) {
  throw "Bundle archive already exists: $ArchivePath"
}

$DatasetSource = Join-Path $ProjectRoot "datasets\$Version"
$EmbeddingSource = Join-Path $ProjectRoot "artifacts\rag\$Version\bge-m3"
$ValidationSource = Join-Path $ProjectRoot "artifacts\rag\$Version\retrieval-validation.json"
$BaselineConfigSource = Join-Path $ProjectRoot "artifacts\rag\$Version\baseline-config.json"
$NotebookSource = Join-Path $ProjectRoot "notebooks\s3_ai03_kaggle_validation.ipynb"

foreach ($RequiredPath in @(
  $DatasetSource,
  $EmbeddingSource,
  $ValidationSource,
  $BaselineConfigSource,
  $NotebookSource
)) {
  if (-not (Test-Path -LiteralPath $RequiredPath)) {
    throw "Required input does not exist: $RequiredPath"
  }
}

New-Item -ItemType Directory -Path $BundleRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BundleRoot "datasets") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BundleRoot "artifacts\rag\$Version") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $ProjectRoot "src") -Destination $BundleRoot -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot "pyproject.toml") -Destination $BundleRoot
Copy-Item -LiteralPath $NotebookSource -Destination $BundleRoot
Copy-Item -LiteralPath $DatasetSource -Destination (Join-Path $BundleRoot "datasets") -Recurse
Copy-Item -LiteralPath $EmbeddingSource -Destination (Join-Path $BundleRoot "artifacts\rag\$Version") -Recurse
Copy-Item -LiteralPath $ValidationSource -Destination (Join-Path $BundleRoot "artifacts\rag\$Version")
Copy-Item -LiteralPath $BaselineConfigSource -Destination (Join-Path $BundleRoot "artifacts\rag\$Version")

Compress-Archive -LiteralPath $BundleRoot -DestinationPath $ArchivePath -CompressionLevel Optimal

Get-Item -LiteralPath $ArchivePath |
  Select-Object FullName, @{Name = "SizeMB"; Expression = { [math]::Round($_.Length / 1MB, 1) } }
