# 生成 Docker 部署用源码包（覆盖 deploy/poster-design-docker-deploy.zip）
# 执行: powershell -ExecutionPolicy Bypass -File pack-deploy.ps1
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ZipPath = Join-Path $PSScriptRoot 'poster-design-docker-deploy.zip'
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('poster-docker-pack-' + [Guid]::NewGuid().ToString())
$StageDir = Join-Path $TempRoot 'poster-design'

try {
  New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

  # /XD 使用相对目录名，可在整棵树中排除同名文件夹（避免误带 node_modules）
  # _zip_inspect：本地解压检视目录，体积大且与源码重复，勿打入部署包
  # poster-design-docker-deploy.zip：勿把旧包打进新包（会指数膨胀）
  $robocopyArgs = @(
    $ProjectRoot, $StageDir,
    '/E',
    '/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np',
    '/XD', 'node_modules',
    '/XD', '.git',
    '/XD', 'dist',
    '/XD', '.vite',
    '/XD', 'runlogs',
    '/XD', 'output',
    '/XD', '.playwright-cli',
    '/XD', '_zip_inspect',
    '/XD', '.idea',
    '/XD', '.vscode',
    '/XD', 'coverage',
    # deploy 目录下的本地构建产物/缓存，体积大且不应进部署源码包（Docker 构建会自行生成）
    '/XD', 'deploy\dist-web',
    '/XD', 'deploy\service-dist',
    '/XD', 'service\node_modules',
    '/XD', 'service\dist',
    '/XD', 'service\static',
    '/XF', 'poster-design-docker-deploy.zip',
    '/XF', 'poster-design-docker-deploy-with-env-latest.zip',
    '/XF', 'poster-design-docker-deploy-with-env-*.zip'
  )

  & robocopy @robocopyArgs
  $rc = $LASTEXITCODE
  if ($rc -ge 8) { throw "robocopy failed with exit code $rc" }

  # service/static：本机运行产生的上传/截图（可达数百 MB）。compose 使用数据卷挂载 /app/static，部署包与镜像均不应携带。
  $stageServiceStatic = Join-Path $StageDir 'service\static'
  if (Test-Path -LiteralPath $stageServiceStatic) {
    Remove-Item -LiteralPath $stageServiceStatic -Recurse -Force
  }

  # 二次清理（防止路径差异导致残留）
  Get-ChildItem -LiteralPath $StageDir -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq 'node_modules' -or $_.Name -eq 'dist' -or $_.Name -eq '.vite' -or
      $_.Name -eq '_zip_inspect' -or $_.Name -eq 'coverage'
    } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

  Get-ChildItem -LiteralPath $StageDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq 'poster-design-docker-deploy.zip' } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }

  $envFile = Join-Path $StageDir 'deploy\.env'
  if (Test-Path $envFile) { Remove-Item -LiteralPath $envFile -Force }

  $packReadme = @'
# 部署包说明

1. 解压得到文件夹 poster-design。
2. 进入 poster-design/deploy，复制环境文件：`cp env.template .env`（Windows: `copy env.template .env`）。
3. 编辑 .env：填写远程 MySQL（DB_HOST / DB_NAME / DB_USERNAME / DB_PASSWORD）、统一登录中心 OAuth、百炼等密钥。
4. 在远程库执行 mysql/init 下 SQL（若尚未建表）。
5. 在 deploy 目录执行：`docker compose -f docker-compose.yaml up -d --build`。

详见 宝塔部署说明.txt。本 zip 不含 node_modules、service/static（运行时上传目录）、deploy/_zip_inspect、历史 poster-design-docker-deploy.zip 等；依赖由 Docker 构建阶段安装；静态资源由容器卷 poster_api_static 持久化。
'@
  Set-Content -Path (Join-Path $StageDir 'deploy\PACK-说明.txt') -Value $packReadme -Encoding UTF8

  if (Test-Path $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
  Compress-Archive -Path $StageDir -DestinationPath $ZipPath -CompressionLevel Optimal -Force
  Write-Host "OK: $ZipPath"
  $item = Get-Item $ZipPath
  Write-Host ("Size: {0:N2} MB" -f ($item.Length / 1MB))
  $item | Format-List FullName, Length, LastWriteTime
}
finally {
  if (Test-Path $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
