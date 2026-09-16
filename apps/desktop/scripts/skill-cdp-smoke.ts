import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPython } from '../src/main/python-runner'

async function main() {
  const desktopRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const cdpPath = resolve(desktopRoot, '..', '..', 'skills/diantoushi-product-research/scripts/run_diantoushi_rpa_cdp.py')

  const playwright = await runPython('-c', ["from importlib.metadata import version; print(version('playwright'))"])
  const noPymysql = await runPython('-c', ['import pymysql'])
  const module = await runPython('-c', [
    `import importlib.util; spec=importlib.util.spec_from_file_location('cdp', ${JSON.stringify(cdpPath)}); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); print(hasattr(mod, 'main'))`,
  ])

  const result = {
    playwrightVersion: playwright.stdout.trim(),
    playwrightOk: playwright.exitCode === 0,
    noPymysql: noPymysql.exitCode !== 0,
    cdpModuleLoadable: module.stdout.trim() === 'True',
  }
  console.log(JSON.stringify(result))
  const ok = result.playwrightOk && result.noPymysql && result.cdpModuleLoadable
  process.exit(ok ? 0 : 1)
}

void main()
