import { closeChrome, launchChromeForRpa, setDownloadBehavior } from '../src/main/chrome'
import { connectScreencast, createLoginTarget } from '../src/main/screencast'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

// 带 canvas 动画的本地页面：CDP Screencast 只推送"内容变化帧"，动态画面才能稳定出帧。
// 注意 data URL 必须 encodeURIComponent，hsl() 里的 % 未经编码会被当转义符导致页面损坏。
const PAGE_RAW =
  '<html><head><title>rpa-smoke</title></head><body><h1>Hello CDP</h1>' +
  '<canvas id=c width=640 height=360></canvas><script>' +
  "const c=document.getElementById('c'),x=c.getContext('2d');let i=0;" +
  'setInterval(()=>{x.fillStyle=`hsl(${i},80%,60%)`;x.fillRect(0,0,640,360);i=(i+3)%360;},60);' +
  '</script></body></html>'
const PAGE_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(PAGE_RAW)}`

async function main() {
  const downloadDir = join(tmpdir(), `eca-smoke-download-${Date.now()}`)
  mkdirSync(downloadDir, { recursive: true })

  // 使用临时 Profile，避免 smoke 反复运行时复用历史 tab 干扰 Screencast 验证。
  const launched = await launchChromeForRpa({
    headless: true,
    persistent: false,
    url: 'about:blank',
    downloadPath: downloadDir,
  })

  await setDownloadBehavior(launched.port, downloadDir)

  // ─── 方案 B：无头容器 + CDP Screencast 画面投射验证 ───
  let frames = 0
  let ackCount = 0
  let screenClosed = false
  const target = await createLoginTarget(launched.port, PAGE_HTML)
  const session = connectScreencast(target, {
    onFrame: (frame) => {
      frames += 1
      const canvas = new Uint8Array(Buffer.from(frame.data, 'base64'))
      // JPEG 魔头 FF D8
      if (canvas.length >= 2 && canvas[0] === 0xff && canvas[1] === 0xd8) ackCount += 1
    },
    onClose: () => {
      screenClosed = true
    },
  })
  // 先等 CDP 长连接就绪（onopen），再开始计帧，避免连接未建立时等待窗口被耗尽。
  await Promise.race([
    session.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('CDP 长连接建立超时 (5s)')), 5000)),
  ]).catch((err: Error) => {
    console.error(JSON.stringify({ error: err.message }))
    process.exit(1)
  })
  // 就绪后等待若干帧（无头动画页投屏通常每 ~250ms 一帧）
  for (let i = 0; i < 20 && frames < 2; i++) {
    await new Promise((r) => setTimeout(r, 300))
  }
  await session.stop()

  const result = {
    port: launched.port,
    profileDir: launched.profileDir,
    isBuiltin: launched.isBuiltin,
    downloadDirReady: existsSync(downloadDir),
    screencastFrames: frames,
    jpegFrames: ackCount,
    screencastStopped: !session.alive,
    closed: screenClosed,
  }
  console.log(JSON.stringify(result))

  closeChrome(launched)
  rmSync(downloadDir, { recursive: true, force: true })

  const ok =
    result.isBuiltin &&
    result.downloadDirReady &&
    typeof result.port === 'number' &&
    result.screencastFrames >= 1 &&
    result.jpegFrames >= 1 &&
    result.screencastStopped
  process.exit(ok ? 0 : 1)
}

void main()