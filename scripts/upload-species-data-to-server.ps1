param(
  [Alias("LocalFile")]
  [string]$File = "D:\Duong\db-backup\vnsc-data-replace-$(Get-Date -Format yyyy-MM-dd).sql",
  [string]$RemoteFileName = "",
  [string]$SshKey = "$env:USERPROFILE\.ssh\jenkins_vn_biodiversity",
  [string]$Server = "dev@100.87.247.104",
  [string]$RemoteDir = "/opt/vn-biodiversity-webgis/imports"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
  throw "Data file not found: $File"
}

if (-not $RemoteFileName) {
  $RemoteFileName = Split-Path -Leaf $File
}

ssh -i "$SshKey" "$Server" "mkdir -p $RemoteDir"

Write-Host "Uploading $File to ${Server}:${RemoteDir}/${RemoteFileName}"
scp -i "$SshKey" "$File" "${Server}:${RemoteDir}/${RemoteFileName}"

if ($LASTEXITCODE -ne 0) {
  throw "scp failed with exit code $LASTEXITCODE"
}

Write-Host "Upload OK. Jenkins IMPORT_FILE should be: $RemoteFileName"
