import { Button, Card, Space, Typography } from '@arco-design/web-react'
import { useLocation } from 'react-router-dom'

export function ReplicatePage() {
  const { pathname } = useLocation()
  const oneClick = pathname.includes('one-click-replicate')
  return (
    <div className="page">
      <Card title={oneClick ? '一键复刻' : '复刻'} style={{ maxWidth: 640 }}>
        <Typography.Paragraph>
          该页面已从旧系统迁移到桌面端。旧版本仅包含本地 Mock 演示逻辑，当前保留入口并明确标注，避免把演示结果误认为真实生图结果。
        </Typography.Paragraph>
        <Space direction="vertical">
          <Typography.Text type="secondary">真实复刻工作流将复用图片生成能力，并在后续接入商品原图、风格参数和生成任务。</Typography.Text>
          <Button type="primary" disabled>开始复刻（真实能力待接入）</Button>
        </Space>
      </Card>
    </div>
  )
}