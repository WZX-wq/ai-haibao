$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path (Join-Path $rootDir 'runlogs') 'dev-processes.json'
$envLocalPath = Join-Path $rootDir '.env.local'
$envPath = Join-Path $rootDir '.env'

function Read-SimpleEnvFile {
  param([string]$FilePath)
  $result = @{}
  if (-not (Test-Path $FilePath)) {
    return $result
  }
  foreach ($line in Get-Content -Path $FilePath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }
    $index = $trimmed.IndexOf('=')
    if ($index -le 0) {
      continue
    }
    $key = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim().Trim("'`"")
    $result[$key] = $value
  }
  return $result
}

$envMap = Read-SimpleEnvFile -FilePath $envPath
$envLocalMap = Read-SimpleEnvFile -FilePath $envLocalPath
foreach ($key in $envLocalMap.Keys) {
  $envMap[$key] = $envLocalMap[$key]
}

$frontendPort = if ($envMap.ContainsKey('VITE_DEV_PORT')) { [int]$envMap['VITE_DEV_PORT'] } elseif ([string]($envMap['VITE_DEV_HOSTNAME'])) { 443 } else { 5173 }
$ports = $frontendPort, 7001

function Stop-PortOwners {
  $owners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $ports } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owner in $owners) {
    if ($owner) {
      Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-PortsReleased {
  $startedAt = Get-Date
  while (((Get-Date) - $startedAt).TotalSeconds -lt 10) {
    $owners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.LocalPort -in $ports } |
      Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $owners -or $owners.Count -eq 0) {
      return
    }

    Start-Sleep -Milliseconds 500
  }
}

if (-not (Test-Path $pidFile)) {
  Stop-PortOwners
  Wait-PortsReleased
  Write-Host 'No recorded background dev processes.'
  exit 0
}

try {
  $payload = Get-Content $pidFile | ConvertFrom-Json
  foreach ($target in $payload.targets) {
    if ($target.pid) {
      Stop-Process -Id $target.pid -Force -ErrorAction SilentlyContinue
    }
  }
  Stop-PortOwners
  Wait-PortsReleased
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host 'Background dev processes stopped.'
} catch {
  Stop-PortOwners
  Wait-PortsReleased
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  throw
}
