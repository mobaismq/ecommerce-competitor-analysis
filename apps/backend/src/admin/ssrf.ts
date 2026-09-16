import { BadRequestException } from '@nestjs/common'

function isPrivateHost(host: string) {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '0.0.0.0'
  )
}

export function assertSafeBaseUrl(baseUrl?: string) {
  if (!baseUrl) return
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new BadRequestException('baseUrl 格式不合法')
  }
  if (url.protocol !== 'https:') throw new BadRequestException('baseUrl 仅允许 HTTPS')
  if (isPrivateHost(url.hostname)) throw new BadRequestException('baseUrl 禁止 localhost/内网/metadata 地址')
  if (url.port && url.port !== '443') throw new BadRequestException('baseUrl 仅允许 443 端口')
}
