/*
 * Single-browser screenshot utility for low-resource environments.
 */
const isDev = process.env.NODE_ENV === 'development'
const puppeteer = require('puppeteer')
const images = require('images')
const { executablePath } = require('../configs.ts')

const forceTimeOut = 60
const maxPXs = 4211840
const maximum = 5000

export const saveScreenshot = async (
  url: string,
  { path, width, height, thumbPath, size = 0, quality = 0, prevent, ua, devices, scale, wait, fullPage }: any,
) => {
  /** 模板侧栏等固定视口缩略图应传 fullPage:false，避免整页滚动高度触发前端误判为占位图 */
  const captureFullPage = fullPage !== false
  return new Promise(async (resolve: Function, reject: Function) => {
    let browser: any = null
    let page: any = null
    let done = false

    width = Number(width).toFixed(0)
    height = Number(height).toFixed(0)

    const puppeteerArgs = {
      // Newer Chrome builds on Windows can crash during screenshot capture when
      // forced into single-process/no-zygote mode. Keep the launch args minimal
      // so dev screenshot generation stays stable.
      old: ['--no-first-run', '--no-sandbox', '--disable-setuid-sandbox', `--window-size=${width},${height}`, '--disable-dev-shm-usage'],
      new: ['--no-first-run', '--no-sandbox', '--disable-setuid-sandbox', `--window-size=${width},${height}`],
    }

    const closeBrowser = async () => {
      if (!browser) return
      try {
        await browser.close()
      } catch {}
      browser = null
    }

    const compress = () => {
      if (!thumbPath) return
      try {
        images(path).size(+size || 300).save(thumbPath, { quality: +quality || 70 })
      } catch (err) {
        console.log('compress failed:', err)
      }
    }

    const finish = async (omitBackground = false) => {
      if (done) return
      done = true
      try {
        await page?.screenshot({ path, fullPage: captureFullPage, omitBackground })
        compress()
        resolve()
      } catch (err) {
        reject(err)
      } finally {
        clearTimeout(regulator)
        await closeBrowser()
      }
    }

    const regulator = setTimeout(async () => {
      console.log('screenshot timeout, forcing capture/close')
      if (!done) {
        try {
          await finish()
          return
        } catch {}
      }
      await closeBrowser()
      resolve()
    }, forceTimeOut * 1000)

    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        ignoreHTTPSErrors: true,
        args: puppeteerArgs.old,
        defaultViewport: null,
      })
    } catch (error) {
      console.log('Puppeteer launch error:', error, width, height)
      clearTimeout(regulator)
      reject(error)
      return
    }

    page = await browser.newPage()

    const limiter = (w: number, h: number) => (w * h < maxPXs ? 1 : +(1 / (w * h) * maxPXs).toFixed(2))
    await page.setViewport({
      width: Number(width) > maximum ? 5000 : Number(width),
      height: Number(height) > maximum ? 5000 : Number(height),
      deviceScaleFactor: !isNaN(scale) ? (+scale > 4 ? 4 : +scale) : limiter(Number(width), Number(height)),
    })

    if (ua) await page.setUserAgent(ua)
    if (devices) {
      const deviceDescriptor = puppeteer.devices[devices]
      if (deviceDescriptor) await page.emulate(deviceDescriptor)
    }

    if (!prevent) {
      page.on('load', async () => {
        try {
          await autoScroll(page)
          await sleep(wait)
          await finish()
        } catch {}
      })
    }

    await page.exposeFunction('loadFinishToInject', async () => {
      try {
        await finish(true)
      } catch {}
    })

    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // If prevent mode is enabled but the page never calls loadFinishToInject,
    // fallback to an automatic capture after a short wait.
    if (prevent) {
      try {
        await sleep(Number(wait) > 0 ? Number(wait) : 2500)
        await finish()
      } catch {}
    }
  })
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise((resolve: any, reject: any) => {
      try {
        const maxScroll = Number.MAX_SAFE_INTEGER
        let lastScroll = 0
        const interval = setInterval(() => {
          window.scrollBy(0, 100)
          const scrollTop = document.documentElement.scrollTop || window.scrollY
          if (scrollTop === maxScroll || scrollTop === lastScroll) {
            clearInterval(interval)
            resolve()
          } else {
            lastScroll = scrollTop
          }
        }, 100)
      } catch (err) {
        reject(err)
      }
    })
  })
}

function sleep(timeout: number = 1) {
  return new Promise((resolve: any) => {
    setTimeout(resolve, timeout)
  })
}

export default { saveScreenshot }
