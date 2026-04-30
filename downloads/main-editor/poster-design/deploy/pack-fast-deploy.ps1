$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'pack-prebuilt-image-bundle.ps1'

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Missing script: $scriptPath"
}

Write-Host 'Fast deploy mode: building prebuilt Docker images for offline/server-side-fast deployment...'
powershell -ExecutionPolicy Bypass -File $scriptPath
