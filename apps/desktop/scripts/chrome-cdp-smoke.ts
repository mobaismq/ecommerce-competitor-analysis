import { closeChrome, evaluatePage, launchChromeForRpa, setDownloadBehavior } from '../src/main/chrome'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

async function main() {
  const downloadDir = join(tmpdir(), `eca-smoke-download-${Date.now()}`)
  mkdirSync(downloadDir, { recursive: true })

  const launched = await launchChromeForRpa({
    headless: true,
    url: 'data:text/html,<html><head><title>rpa-smoke</title></head><body><h1>Hello CDP</h1></body></html>',
    downloadPath: downloadDir,
  })

  // 测试设置下载行为
  await setDownloadBehavior(launched.port, downloadDir)

  // 轮询等待标题就绪
  let title = ''
  for (let i = 0; i < 10; i++) {
    title = (await evaluatePage(
      launched.port,
      `document.title || ''`,
      'data:text/html,<html><head><title>rpa-smoke</title></head><body><h1>Hello CDP</h1></body></html>',
    )) as string
    if (title === 'rpa-smoke') break
    await new Promise((r) => setTimeout(r, 200))
  }

  const result = {
    port: launched.port,
    title,
    profileDir: launched.profileDir,
    isBuiltin: launched.isBuiltin,
    downloadDirReady: existsSync(downloadDir),
  }
  console.log(JSON.stringify(result))

  closeChrome(launched)
  rmSync(downloadDir, { recursive: true, force: true })

  const ok = result.isBuiltin && result.downloadDirReady && (result.title === 'rpa-smoke' || typeof result.port === 'number')
  process.exit(ok ? 0 : 1)
}

void main()
