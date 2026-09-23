import React, { useState } from 'react'

interface ImageWithFallbackProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> {
  src?: string | null
}

/**
 * 图片兜底组件（对照旧版 figma/ImageWithFallback）：加载失败时展示占位块而非破图。
 * 兜底策略：真实资源加载失败才隐藏/占位，不伪造任何图片数据。
 */
export function ImageWithFallback({ src, alt, className = '', ...rest }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          background: '#f2f4f7',
          color: '#98a2b3',
          fontSize: 12,
          ...rest.style,
        }}
        title={alt}
      >
        {alt || '无图'}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      className={className}
      {...rest}
      onError={() => setFailed(true)}
    />
  )
}