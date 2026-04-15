## Node截图服务

项目中所使用到的图片生成接口为：`api/screenshots`，在真实生产项目中可以把该服务单独部署，于内网调用，这样利于做一些鉴权之类的处理。

注：另外的 `api/printscreen` 本项目中并未使用，这个接口的作用是实现普通网页截图，可以传入一个 URL 生成该网址的预览图片，用于合成长图分享海报等场景。

### 安装依赖

`npm install`

安装依赖时可能会出现这个报错提示：

```
ERROR: Failed to set up Chromium xxx! Set "PUPPETEER_SKIP_DOWNLOAD" env variable to skip download.
```

不用慌，这是因为 puppeteer 会自动下载 Chromium，国内可能受到网络波动的影响而失败。

如果跳过的话需要手动安装，比较麻烦所以并不推荐，请**多尝试安装几次，或者更换国内的镜像源再安装**。

### 启动项目并热更新

`npm run dev`

### 本地抠图模型（rembg）配置

如果你希望抠图优先走本地模型（而不是云端服务），当前项目已支持，按下面步骤执行：

1. 在 `service/.env` 中保持以下配置：

```env
AI_CUTOUT_PROVIDER=rembg,mock
AI_CUTOUT_REMBG_MODEL=u2net
AI_CUTOUT_PYTHON=python
```

2. 安装 Python 依赖（建议 Python 3.10+）：

```bash
pip install rembg onnxruntime pillow
```

3. 首次调用抠图接口时，`rembg` 会自动下载模型到本机缓存目录（只下载一次）。

4. 快速自检（项目根目录）：

```bash
python scripts/cutout_worker.py rembg static/test/input.png static/test/output.png u2net
```

如果命令执行成功并输出图片，说明本地抠图模型配置生效。

### 打包

`npm run build`

#### 打包部署步骤

> 服务器环境需求：
> 
> - Node.js 16.18.1（尽量保持生产版本相同，避免出现错误）
> 
> - PM2（进程守护）

1. 本地执行 `npm run build` 打包
2. 打包后项目根目录 `dist/` 文件夹上传服务器，并执行 `npm install` 安装依赖
3. 运行 `pm2 start dist/server.js` 启动并守护服务

### 配置说明

配置文件 `src/config.ts` 配置项说明：

```js
port // 端口号
website // 编辑器项目的地址
filePath // 生成图片保存的目录
```

### 多线程集群

本服务中实现多任务操作使用的是队列的处理方式，保留了 JavaScript 单线程的特点，线程安全并且性能高效，能够保证下限更稳定，但在高配置机器上可能无法充分利用多核 CPU 资源。

如果你希望在配置更高的机器上创建多线程集群，可以尝试使用 [puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster)。

### 生成 API 文档

`build:apidoc`