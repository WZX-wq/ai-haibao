import fs from 'fs'
import path from 'path'

let cached: string | null = null

function hasMockTree(dir: string): boolean {
  const markers = [
    path.join(dir, 'materials', 'png.json'),
    path.join(dir, 'templates', 'list.json'),
    path.join(dir, 'components', 'list', 'text.json'),
  ]
  return markers.some((p) => fs.existsSync(p))
}

/**
 * Webpack 单包后 __dirname 常为 dist/，原 ../mock 会指到与 src/mock 不一致的路径。
 * 依次探测 dist 旁 mock、cwd/src/mock、cwd/mock。
 */
export function getMockRoot(): string {
  if (cached && fs.existsSync(cached)) return cached
  const candidates = [
    path.resolve(__dirname, '..', 'mock'),
    path.join(process.cwd(), 'src', 'mock'),
    path.join(process.cwd(), 'mock'),
  ]
  for (const dir of candidates) {
    if (hasMockTree(dir)) {
      cached = dir
      return dir
    }
  }
  cached = candidates[1]
  return cached
}

export function mockPath(...parts: string[]): string {
  return path.join(getMockRoot(), ...parts)
}

/** 例如 mockRel('components/list/text.json') */
export function mockRel(rel: string): string {
  return path.join(getMockRoot(), ...rel.split('/').filter(Boolean))
}
