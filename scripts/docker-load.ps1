$ErrorActionPreference = "Stop"

$root = Resolve-Path $PSScriptRoot
$imageTar = Join-Path $root "images\vn-biodiversity-webgis-images.tar"

if (-not (Test-Path $imageTar)) {
  throw "Missing Docker image archive: $imageTar"
}

Write-Host "Loading Docker images from $imageTar ..."
docker image load -i $imageTar

Write-Host ""
Write-Host "Images loaded. Next commands:"
Write-Host "  Copy-Item .env.docker.example .env.docker"
Write-Host "  docker compose --env-file .env.docker up"
