import { spawnSync } from 'node:child_process'

process.env.UPDATE_URL ||= 'https://updates.example.invalid/desktop'

const result = spawnSync('electron-builder', ['--config', 'electron-builder.yml'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
