param(
  [Alias("LocalFile")]
  [string]$File = "D:\Duong\db-backup\vnsc-data-update-$(Get-Date -Format yyyy-MM-dd).sql",
  [string]$RemoteFileName = "",
  [string]$SshKey = "",
  [string]$Server = "",
  [string]$RemoteDir = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
  throw "Data file not found: $File"
}

if (-not $SshKey) {
  throw "Missing SSH key. Pass -SshKey."
}

if (-not $Server) {
  throw "Missing server. Pass -Server."
}

if (-not $RemoteDir) {
  throw "Missing remote import directory. Pass -RemoteDir."
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
