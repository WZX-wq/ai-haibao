$ErrorActionPreference = 'Stop'

$serviceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $serviceDir

$logPath = Join-Path $serviceDir 'service-dev.log'
$errPath = Join-Path $serviceDir 'service-dev.err.log'

if (Test-Path $logPath) {
  Remove-Item $logPath -Force
}
if (Test-Path $errPath) {
  Remove-Item $errPath -Force
}

Start-Process `
  -FilePath 'C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe' `
  -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', "Set-Location '$serviceDir'; npm run dev *>> '$logPath' 2>> '$errPath'"
  ) `
  -WindowStyle Hidden

Start-Sleep -Seconds 6

Write-Host "service cwd: $serviceDir"
Write-Host 'service status:'
netstat -ano | Select-String ':7001'

if (Test-Path $logPath) {
  Write-Host 'service log:'
  Get-Content $logPath -Tail 20
}

if (Test-Path $errPath) {
  $errContent = Get-Content $errPath -Tail 20
  if ($errContent) {
    Write-Host 'service error log:'
    $errContent
  }
}
