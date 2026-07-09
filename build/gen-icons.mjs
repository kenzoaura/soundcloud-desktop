// Rasterizes build/icon.svg + build/tray.svg into the PNG/ICO assets the app
// and installer need. Run: node build/gen-icons.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(dir, '..', 'public')

const iconSvg = await readFile(join(dir, 'icon.svg'))
const traySvg = await readFile(join(dir, 'tray.svg'))

// App icon PNGs (for the .ico) + a 512 png for Linux/build.
const icoSizes = [256, 128, 64, 48, 32, 16]
const pngBuffers = await Promise.all(
  icoSizes.map((s) => sharp(iconSvg).resize(s, s).png().toBuffer()),
)
await writeFile(join(dir, 'icon.ico'), await pngToIco(pngBuffers))
await sharp(iconSvg).resize(512, 512).png().toFile(join(dir, 'icon.png'))
await sharp(iconSvg).resize(256, 256).png().toFile(join(publicDir, 'icon.png'))

// Tray icons (transparent, orange mark). Windows tray ~16-32px.
await sharp(traySvg).resize(32, 32).png().toFile(join(publicDir, 'tray.png'))
await sharp(traySvg).resize(32, 32).png().toFile(join(dir, 'tray.png'))

console.log('icons generated: build/icon.ico, build/icon.png, public/icon.png, public/tray.png')
