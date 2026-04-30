$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BundleRoot = Join-Path $PSScriptRoot 'prebuilt-image-bundle'
$ImagesDir = Join-Path $BundleRoot 'images'
$ZipPath = Join-Path $PSScriptRoot 'poster-design-prebuilt-images-deploy.zip'

$ApiImage = 'poster-design-api:prebuilt'
$WebImage = 'poster-design-web:prebuilt'
$ApiRuntimeBaseImage = 'poster-design-api-runtime:headless-shell'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

Require-Command 'docker'

if (Test-Path -LiteralPath $BundleRoot) {
  Remove-Item -LiteralPath $BundleRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $ImagesDir -Force | Out-Null

$dockerHubMirror = if ($env:DOCKER_HUB_MIRROR) { $env:DOCKER_HUB_MIRROR } else { 'docker.io' }
$npmRegistry = if ($env:NPM_REGISTRY) { $env:NPM_REGISTRY } else { 'https://mirrors.cloud.tencent.com/npm/' }
$aptMirror = if ($env:APT_MIRROR_ROOT) { $env:APT_MIRROR_ROOT } else { 'http://deb.debian.org/debian' }
$aptSecurityMirror = if ($env:APT_SECURITY_MIRROR_ROOT) { $env:APT_SECURITY_MIRROR_ROOT } else { 'http://deb.debian.org/debian-security' }
$aptHttpProxy = if ($env:APT_HTTP_PROXY) { $env:APT_HTTP_PROXY } else { '' }
$aptHttpsProxy = if ($env:APT_HTTPS_PROXY) { $env:APT_HTTPS_PROXY } else { '' }
$rembgModelMirror = if ($env:REMBG_MODEL_MIRROR) { $env:REMBG_MODEL_MIRROR } else { 'https://ghproxy.net/' }
$rembgModelName = if ($env:AI_CUTOUT_REMBG_MODEL) { $env:AI_CUTOUT_REMBG_MODEL } else { 'u2net' }
$viteApiUrl = if ($env:VITE_API_URL) { $env:VITE_API_URL } else { '' }
$viteScreenUrl = if ($env:VITE_SCREEN_URL) { $env:VITE_SCREEN_URL } else { '' }

Push-Location $ProjectRoot
try {
  $forceRebuildBase = $env:FORCE_REBUILD_API_BASE -eq '1'
  $baseExists = $false
  try {
    docker image inspect $ApiRuntimeBaseImage *> $null
    $baseExists = $LASTEXITCODE -eq 0
  } catch {}

  if ($forceRebuildBase -or -not $baseExists) {
    Invoke-Checked {
      docker build `
        -f deploy/Dockerfile.api-base `
        -t $ApiRuntimeBaseImage `
        --build-arg "REGISTRY_PREFIX=$dockerHubMirror" `
        --build-arg "APT_MIRROR_ROOT=$aptMirror" `
        --build-arg "APT_SECURITY_MIRROR_ROOT=$aptSecurityMirror" `
        --build-arg "CHROMIUM_PACKAGE=chromium-headless-shell" `
        --build-arg "APT_HTTP_PROXY=$aptHttpProxy" `
        --build-arg "APT_HTTPS_PROXY=$aptHttpsProxy" `
        --build-arg "REMBG_MODEL_MIRROR=$rembgModelMirror" `
        --build-arg "REMBG_MODEL_NAME=$rembgModelName" `
        .
    }
  } else {
    Write-Host "Reuse existing API runtime base image: $ApiRuntimeBaseImage"
  }

  Invoke-Checked {
    docker build `
      -f deploy/Dockerfile.api.fast `
      -t $ApiImage `
      --build-arg "REGISTRY_PREFIX=$dockerHubMirror" `
      --build-arg "NPM_REGISTRY=$npmRegistry" `
      --build-arg "API_RUNTIME_BASE=$ApiRuntimeBaseImage" `
      .
  }

  Invoke-Checked {
    docker build `
      -f deploy/Dockerfile.web `
      -t $WebImage `
      --build-arg "REGISTRY_PREFIX=$dockerHubMirror" `
      --build-arg "NPM_REGISTRY=$npmRegistry" `
      --build-arg "VITE_API_URL=$viteApiUrl" `
      --build-arg "VITE_SCREEN_URL=$viteScreenUrl" `
      .
  }
}
finally {
  Pop-Location
}

Invoke-Checked {
  docker save -o (Join-Path $ImagesDir 'poster-design-api-prebuilt.tar') $ApiImage
}
Invoke-Checked {
  docker save -o (Join-Path $ImagesDir 'poster-design-web-prebuilt.tar') $WebImage
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'docker-compose.prebuilt.yaml') -Destination (Join-Path $BundleRoot 'docker-compose.yaml')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'env.template') -Destination (Join-Path $BundleRoot 'env.template')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env') -Destination (Join-Path $BundleRoot '.env')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'bootstrap-cutout.sh') -Destination (Join-Path $BundleRoot 'bootstrap-cutout.sh')
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'service\scripts\cutout_worker.py') -Destination (Join-Path $BundleRoot 'cutout_worker.py')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'oauth2-api.md') -Destination (Join-Path $BundleRoot 'oauth2-api.md')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '配置检查清单.md') -Destination (Join-Path $BundleRoot '配置检查清单.md')

$readme = @'
# Prebuilt Image Deployment Package

This bundle contains prebuilt Docker images, so the server does not need to run `npm ci` or build source code.

Files:
- `images/poster-design-api-prebuilt.tar`
- `images/poster-design-web-prebuilt.tar`
- `docker-compose.yaml`
- `.env`
- `env.template`

Deploy:
1. Copy this folder to the server.
2. Review `.env` and adjust only if needed.
3. Load the images:
   - `docker load -i images/poster-design-api-prebuilt.tar`
   - `docker load -i images/poster-design-web-prebuilt.tar`
4. Start services:
   - `docker compose up -d`
'@
Set-Content -LiteralPath (Join-Path $BundleRoot 'README.txt') -Value $readme -Encoding UTF8

if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

Compress-Archive -Path $BundleRoot -DestinationPath $ZipPath -CompressionLevel Optimal -Force

$zip = Get-Item -LiteralPath $ZipPath
Write-Host "OK: $($zip.FullName)"
Write-Host ("Size: {0:N2} MB" -f ($zip.Length / 1MB))
