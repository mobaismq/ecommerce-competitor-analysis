import { BadRequestException } from '@nestjs/common'
import { assertSafeBaseUrl } from './ssrf'

describe('assertSafeBaseUrl', () => {
  it('不传值或 undefined 时不抛错', () => {
    expect(() => assertSafeBaseUrl()).not.toThrow()
    expect(() => assertSafeBaseUrl(undefined)).not.toThrow()
  })

  it('允许公网 HTTPS 443 地址', () => {
    expect(() => assertSafeBaseUrl('https://api.example.com/path?x=1')).not.toThrow()
    expect(() => assertSafeBaseUrl('https://example.com:443/x')).not.toThrow()
  })

  it('拒绝非 HTTPS 协议', () => {
    expect(() => assertSafeBaseUrl('http://example.com/x')).toThrow(BadRequestException)
    expect(() => assertSafeBaseUrl('ftp://example.com/x')).toThrow(BadRequestException)
  })

  it('拒绝 localhost / 内网 / metadata 地址', () => {
    const blocklist = [
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://::1/x',
      'https://10.0.0.1/x',
      'https://192.168.1.1/x',
      'https://172.16.0.1/x',
      'https://172.31.255.1/x',
      'https://0.0.0.0/x',
      'https://metadata.google.internal/x',
      'https://api.internal/x',
      'https://data.lan.internal/y',
    ]
    for (const url of blocklist) {
      expect(() => assertSafeBaseUrl(url)).toThrow(BadRequestException)
    }
  })

  it('拒绝非 443 端口', () => {
    expect(() => assertSafeBaseUrl('https://api.example.com:8443/x')).toThrow(BadRequestException)
  })

  it('拒绝格式非法的 URL', () => {
    expect(() => assertSafeBaseUrl('not a url')).toThrow(BadRequestException)
  })
})