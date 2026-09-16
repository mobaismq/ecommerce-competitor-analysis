import { closeChrome, evaluatePage, launchChromeForRpa } from '../src/main/chrome'

async function main() {
  const launched = await launchChromeForRpa({ headless: true, url: 'data:text/html,<title>rpa-smoke</title>' })
  const title = await evaluatePage(
    launched.port,
    `(async () => { await new Promise((r) => { if (document.readyState === 'complete') r(); else window.addEventListener('load', r) }); return document.title })()`,
    'data:text/html,<title>rpa-smoke</title>',
  )
  const result = { port: launched.port, title, profileDir: launched.profileDir }
  console.log(JSON.stringify(result))
  closeChrome(launched)
  process.exit(result.title === 'rpa-smoke' ? 0 : 1)
}

void main()
