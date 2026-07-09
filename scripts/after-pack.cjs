// electron-builder afterPack hook: embed the SoundCloud icon into the packaged
// Windows .exe using rcedit directly. We do this here because
// signAndEditExecutable is disabled (electron-builder's edit step pulls
// winCodeSign, whose symlink extraction needs Developer Mode on this machine).
const path = require('node:path')
const rceditMod = require('rcedit')
const rcedit =
  typeof rceditMod === 'function' ? rceditMod : rceditMod.rcedit || rceditMod.default

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const icon = path.join(context.packager.projectDir, 'build', 'icon.ico')
  try {
    await rcedit(exe, { icon })
    console.log(`[after-pack] embedded icon into ${exe}`)
  } catch (e) {
    console.warn(`[after-pack] failed to set icon: ${e}`)
  }
}
