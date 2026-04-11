import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

type TExportFormat = 'png' | 'jpg' | 'pdf'

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
}

async function renderPosterCanvas(canvasId: string) {
  const source = document.getElementById(canvasId) as HTMLElement | null
  if (!source) {
    throw new Error('poster canvas not found')
  }

  await document.fonts.ready
  await waitForImages(source)

  const fonts = document.fonts
  const cloned = source.cloneNode(true) as HTMLElement
  cloned.setAttribute('id', 'clone-page')
  cloned.style.width = `${source.offsetWidth}px`
  cloned.style.height = `${source.offsetHeight}px`
  cloned.style.transform = 'none'
  cloned.style.transformOrigin = 'top left'
  cloned.style.position = 'fixed'
  cloned.style.left = '0'
  cloned.style.top = '0'
  cloned.style.margin = '0'
  cloned.style.opacity = '1'
  cloned.style.pointerEvents = 'none'
  cloned.style.zIndex = '-1'
  document.body.appendChild(cloned)

  try {
    await waitForImages(cloned)
    const canvas = await html2canvas(cloned, {
      backgroundColor: null,
      useCORS: true,
      scale: window.devicePixelRatio > 1 ? 2 : 1,
      width: source.offsetWidth,
      height: source.offsetHeight,
      windowWidth: source.offsetWidth,
      windowHeight: source.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc: Document) => {
        fonts.forEach((font) => doc.fonts.add(font))
      },
    })
    return canvas
  } finally {
    cloned.remove()
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('failed to create blob'))
    }, type, quality)
  })
}

export async function exportPoster(fileName: string, format: TExportFormat, canvasId = 'page-design-canvas') {
  const canvas = await renderPosterCanvas(canvasId)
  if (format === 'pdf') {
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [canvas.width, canvas.height],
    })
    const dataUrl = canvas.toDataURL('image/png')
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${fileName}.pdf`)
    return
  }

  if (format === 'jpg') {
    const whiteCanvas = document.createElement('canvas')
    whiteCanvas.width = canvas.width
    whiteCanvas.height = canvas.height
    const context = whiteCanvas.getContext('2d')
    if (!context) throw new Error('failed to create canvas context')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height)
    context.drawImage(canvas, 0, 0)
    const blob = await canvasToBlob(whiteCanvas, 'image/jpeg', 0.92)
    saveBlob(blob, `${fileName}.jpg`)
    return
  }

  const blob = await canvasToBlob(canvas, 'image/png')
  saveBlob(blob, `${fileName}.png`)
}
