$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$runlogsDir = Join-Path $rootDir 'runlogs'
$pidFile = Join-Path $runlogsDir 'dev-processes.json'
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'
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

$devHostname = [string]($envMap['VITE_DEV_HOSTNAME'])
$frontendPort = if ($envMap.ContainsKey('VITE_DEV_PORT')) { [int]$envMap['VITE_DEV_PORT'] } elseif ($devHostname) { 443 } else { 5173 }
$backendPort = 7001
$frontendProtocol = if ($devHostname) { 'https' } else { 'http' }
$frontendHost = if ($devHostname) { $devHostname } else { '127.0.0.1' }
$defaultPort = if ($frontendProtocol -eq 'https') { 443 } else { 80 }
$frontendUrl = if ($frontendPort -eq $defaultPort) { "${frontendProtocol}://${frontendHost}/" } else { "${frontendProtocol}://${frontendHost}:${frontendPort}/" }
$backendUrl = 'http://127.0.0.1:7001/design/cate?type=1'

New-Item -ItemType Directory -Force -Path $runlogsDir | Out-Null

function Test-PortReady {
  param([int]$Port)
  $connection = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $Port } | Select-Object -First 1
  return $null -ne $connection
}

function Wait-PortReady {
  param([int]$Port, [int]$TimeoutSeconds = 30)
  $startedAt = Get-Date
  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
    if (Test-PortReady -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Test-EndpointReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3 -SkipCertificateCheck
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-EndpointReady {
  param([string]$Url, [int]$TimeoutSeconds = 30)
  $startedAt = Get-Date
  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
    if (Test-EndpointReady -Url $Url) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Wait-PortsReleased {
  param([int[]]$Ports, [int]$TimeoutSeconds = 10)
  $startedAt = Get-Date
  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
    $owners = Get-PortOwners -Ports $Ports
    if (-not $owners -or $owners.Count -eq 0) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
}

function Get-PortOwners {
  param([int[]]$Ports)
  return Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $Ports } |
    Select-Object -ExpandProperty OwningProcess -Unique
}

function Stop-PortOwners {
  param([int[]]$Ports)
  $owners = Get-PortOwners -Ports $Ports
  foreach ($owner in $owners) {
    if ($owner) {
      Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-RecordedProcesses {
  if (-not (Test-Path $pidFile)) {
    return
  }

  try {
    $payload = Get-Content $pidFile | ConvertFrom-Json
    foreach ($target in $payload.targets) {
      if ($target.pid) {
        Stop-Process -Id $target.pid -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
  } finally {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }

  Stop-PortOwners -Ports @($frontendPort, $backendPort)
  Wait-PortsReleased -Ports @($frontendPort, $backendPort)
}

function Start-DevProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$LogPath,
    [string]$ErrPath
  )

  Set-Content -Path $LogPath -Value ''
  Set-Content -Path $ErrPath -Value ''

  $command = "Set-Location '$WorkingDirectory'; & '$npmCmd' run dev *>> '$LogPath' 2>> '$ErrPath'"
  return Start-Process `
    -FilePath 'C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WorkingDirectory $WorkingDirectory `
    -PassThru `
    -WindowStyle Hidden
}

Stop-RecordedProcesses

$existingOwners = Get-PortOwners -Ports @($frontendPort, $backendPort)
if ($existingOwners.Count -gt 0) {
  Write-Error "Ports $frontendPort/$backendPort are already occupied. Please stop old dev processes first."
}

$frontend = Start-DevProcess `
  -Name 'frontend' `
  -WorkingDirectory $rootDir `
  -LogPath (Join-Path $runlogsDir 'frontend.log') `
  -ErrPath (Join-Path $runlogsDir 'frontend.err.log')

$backend = Start-DevProcess `
  -Name 'backend' `
  -WorkingDirectory (Join-Path $rootDir 'service') `
  -LogPath (Join-Path $runlogsDir 'backend.log') `
  -ErrPath (Join-Path $runlogsDir 'backend.err.log')

$frontendReady = Wait-PortReady -Port $frontendPort
$backendReady = Wait-PortReady -Port $backendPort

if (-not ($frontendReady -and $backendReady)) {
  Write-Host 'Frontend log tail:'
  Get-Content (Join-Path $runlogsDir 'frontend.log') -Tail 20 -ErrorAction SilentlyContinue
  Write-Host 'Frontend err tail:'
  Get-Content (Join-Path $runlogsDir 'frontend.err.log') -Tail 20 -ErrorAction SilentlyContinue
  Write-Host 'Backend log tail:'
  Get-Content (Join-Path $runlogsDir 'backend.log') -Tail 20 -ErrorAction SilentlyContinue
  Write-Host 'Backend err tail:'
  Get-Content (Join-Path $runlogsDir 'backend.err.log') -Tail 20 -ErrorAction SilentlyContinue

  foreach ($proc in @($frontend, $backend)) {
    if ($proc -and -not $proc.HasExited) {
      taskkill /PID $proc.Id /T /F | Out-Null
    }
  }

  Write-Error 'Failed to start frontend/backend in background.'
}

@{
  startedAt = (Get-Date).ToString('o')
  targets = @(
    @{
      name = 'frontend'
      pid = $frontend.Id
      port = $frontendPort
      log = (Join-Path $runlogsDir 'frontend.log')
      err = (Join-Path $runlogsDir 'frontend.err.log')
    },
    @{
      name = 'backend'
      pid = $backend.Id
      port = $backendPort
      log = (Join-Path $runlogsDir 'backend.log')
      err = (Join-Path $runlogsDir 'backend.err.log')
    }
  )
} | ConvertTo-Json -Depth 4 | Set-Content -Path $pidFile

Write-Host 'Background dev servers are ready.'
Write-Host "Frontend: $frontendUrl"
Write-Host 'Backend:  http://127.0.0.1:7001/'
Write-Host "Logs:     $runlogsDir"
