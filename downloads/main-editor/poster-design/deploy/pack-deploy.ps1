$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ZipPath = Join-Path $PSScriptRoot 'poster-design-docker-deploy.zip'
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('poster-docker-pack-' + [Guid]::NewGuid().ToString())
$StageDir = Join-Path $TempRoot 'poster-design'

try {
  New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

  $robocopyArgs = @(
    $ProjectRoot, $StageDir,
    '/E',
    '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP',
    '/XD', 'node_modules',
    '/XD', '.git',
    '/XD', 'dist',
    '/XD', '.vite',
    '/XD', 'runlogs',
    '/XD', 'output',
    '/XD', '.playwright-cli',
    '/XD', '_zip_inspect',
    '/XD', '_deploy_stage',
    '/XD', '.idea',
    '/XD', '.vscode',
    '/XD', 'coverage',
    '/XD', 'deploy\prebuilt-image-bundle',
    '/XD', 'service\node_modules',
    '/XD', 'service\dist',
    '/XD', 'service\static',
    '/XF', 'poster-design-docker-deploy.zip',
    '/XF', 'poster-design-prebuilt-images-deploy.zip'
  )

  & robocopy @robocopyArgs | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -ge 8) {
    throw "robocopy failed with exit code $rc"
  }

  $stageServiceStatic = Join-Path $StageDir 'service\static'
  if (Test-Path -LiteralPath $stageServiceStatic) {
    Remove-Item -LiteralPath $stageServiceStatic -Recurse -Force
  }

  Get-ChildItem -LiteralPath $StageDir -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -in @('node_modules', 'dist', '.vite', '_zip_inspect', 'coverage')
    } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }

  Get-ChildItem -LiteralPath $StageDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq 'poster-design-docker-deploy.zip' } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }

  $packReadme = @'
# Deployment Package

This package contains the source tree for Docker deployment.

1. Extract the zip file.
2. Go to `poster-design/deploy`.
3. Review the included `.env` and adjust only if needed.
4. Fill in database, OAuth, and other required environment variables only if your server differs from the packaged config.
5. Initialize MySQL with the SQL files in `deploy/mysql` if needed.
6. Run `docker compose -f docker-compose.yaml up -d --build`.

Excluded from this package:
- `node_modules`
- `service/static`
- build caches and test output
- nested historical deployment zip files
'@
  Set-Content -LiteralPath (Join-Path $StageDir 'deploy\PACK-README.txt') -Value $packReadme -Encoding UTF8

  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  Compress-Archive -Path $StageDir -DestinationPath $ZipPath -CompressionLevel Optimal -Force

  $item = Get-Item -LiteralPath $ZipPath
  Write-Host "OK: $($item.FullName)"
  Write-Host ("Size: {0:N2} MB" -f ($item.Length / 1MB))
  $item | Format-List FullName, Length, LastWriteTime
}
finally {
  if (Test-Path -LiteralPath $TempRoot) {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
