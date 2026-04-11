$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path (Join-Path $rootDir 'runlogs') 'dev-processes.json'
$ports = 5173, 7001

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
