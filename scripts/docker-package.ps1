param(
  [string]$OutputDir = "docker-package",
  [switch]$SkipDatabase
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$packageRoot = Join-Path $root $OutputDir
$imageDir = Join-Path $packageRoot "images"
$dbTargetDir = Join-Path $packageRoot "vn-biodiversity-webgis-DB"
$dbInitTargetDir = Join-Path $dbTargetDir "docker-init"

Write-Host "Preparing Docker package at $packageRoot"

New-Item -ItemType Directory -Force $packageRoot | Out-Null
New-Item -ItemType Directory -Force $imageDir | Out-Null

Write-Host "Building API and frontend images..."
docker compose --env-file (Join-Path $root ".env.docker") build api frontend

Write-Host "Saving Docker images..."
docker image save `
  -o (Join-Path $imageDir "vn-biodiversity-webgis-images.tar") `
  postgres:18 `
  vn-biodiversity-webgis-api:latest `
  vn-biodiversity-webgis-frontend:latest

Copy-Item (Join-Path $root "docker-compose.portable.yml") (Join-Path $packageRoot "docker-compose.yml") -Force
Copy-Item (Join-Path $root ".env.docker.portable.example") (Join-Path $packageRoot ".env.docker.example") -Force
Copy-Item (Join-Path $root "scripts\docker-load.ps1") (Join-Path $packageRoot "docker-load.ps1") -Force

if (-not $SkipDatabase) {
  Write-Host "Copying database init files. This can take a while if 001-init.sql is large..."
  New-Item -ItemType Directory -Force $dbInitTargetDir | Out-Null
  Copy-Item (Join-Path $root "vn-biodiversity-webgis-DB\docker-init\*") $dbInitTargetDir -Recurse -Force
} else {
  Write-Host "Skipping database init files."
  New-Item -ItemType Directory -Force $dbInitTargetDir | Out-Null
  New-Item -ItemType File -Force (Join-Path $dbInitTargetDir ".gitkeep") | Out-Null
}

Write-Host ""
Write-Host "Docker package is ready:"
Write-Host $packageRoot
Write-Host ""
Write-Host "On another machine, copy this folder, then run:"
Write-Host "  Copy-Item .env.docker.example .env.docker"
Write-Host "  .\docker-load.ps1"
Write-Host "  docker compose --env-file .env.docker up"
