import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// 由 node --test 执行，在临时工程验证提取与打包准备，不启动浏览器、不访问网络。
test('导入完整插件并清理 metadata，后续准备保留新版，损坏导入不覆盖现有文件', () => {
  const temp = mkdtempSync(join(tmpdir(), 'dts import test '))
  try {
    const scripts = join(temp, 'desktop/scripts')
    const source = join(temp, 'Chrome Profile/5.1.1_0')
    mkdirSync(scripts, { recursive: true })
    mkdirSync(join(source, '_metadata'), { recursive: true })
    cpSync(new URL('./prepare-diantoushi-extension.mjs', import.meta.url), join(scripts, 'prepare.mjs'))
    const manifest = { name: '店透视', version: '5.1.1', manifest_version: 3, key: 'public-test-key', background: { service_worker: 'worker.js' } }
    writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest))
    writeFileSync(join(source, 'worker.js'), '// test fixture')
    writeFileSync(join(source, '_metadata/verified_contents.json'), '{}')
    const run = (...args) => execFileSync(process.execPath, [join(scripts, 'prepare.mjs'), ...args], { encoding: 'utf8', timeout: 5000 })
    run('--source', source)
    const target = join(temp, 'desktop/resources/extensions/diantoushi')
    assert.equal(existsSync(join(target, '_metadata')), false)
    assert.equal(readFileSync(join(target, 'worker.js'), 'utf8'), '// test fixture')
    assert.deepEqual(JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8')), manifest)
    assert.match(run(), /保留.*5\.1\.1/)
    assert.match(run('--verify-only'), /校验通过/)
    rmSync(join(source, 'worker.js'))
    assert.throws(() => run('--source', source), /扩展引用文件缺失/)
    assert.equal(existsSync(join(target, 'worker.js')), true)
    rmSync(join(target, 'worker.js'))
    assert.throws(() => run('--verify-only'), /扩展引用文件缺失/)
  } finally { rmSync(temp, { recursive: true, force: true }) }
})
