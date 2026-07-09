export interface RGB {
  r: number
  g: number
  b: number
}

export function quantizeDominant(pixels: Uint8ClampedArray): RGB {
  let r = 0,
    g = 0,
    b = 0,
    n = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue // skip near-transparent
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    n++
  }
  if (n === 0) return { r: 40, g: 40, b: 40 }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

export function rgbToCss(c: RGB, alpha?: number): string {
  return alpha === undefined ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

const cache = new Map<string, RGB | null>()

export function clearColorCache(): void {
  cache.clear()
}

function colorFromSrc(src: string): Promise<RGB | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, 24, 24)
        const data = ctx.getImageData(0, 0, 24, 24).data
        resolve(quantizeDominant(data))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function getCoverColor(url: string): Promise<RGB | null> {
  if (!url) return null
  const hit = cache.get(url)
  if (hit !== undefined) return hit
  // The renderer can't read sndcdn pixels directly (CORS taints the canvas), so
  // fetch the bytes through the main process as a same-origin data URL.
  let color: RGB | null = null
  try {
    const dataUrl = await window.sc.coverBytes(url)
    if (dataUrl) color = await colorFromSrc(dataUrl)
  } catch {
    color = null
  }
  cache.set(url, color)
  return color
}
