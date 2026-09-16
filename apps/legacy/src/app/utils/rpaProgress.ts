export type RpaProgress = {
  current: number | null;
  total: number | null;
  label: string;
  detail: string;
  percent: number | null;
};

export function parseRpaProgress(logTail?: string, topN?: number | null): RpaProgress {
  const text = logTail || "";
  let current: number | null = null;
  let total: number | null = Number.isFinite(Number(topN)) ? Number(topN) : null;
  let lastItemIndex = -1;

  const itemPattern = /=== batch item (\d+)\/(\d+)\b/g;
  for (let match = itemPattern.exec(text); match; match = itemPattern.exec(text)) {
    current = Number(match[1]);
    total = Number(match[2]);
    lastItemIndex = match.index;
  }

  const summaryIndex = text.lastIndexOf("=== batch summary");
  const analysisIndex = Math.max(
    text.lastIndexOf("=== market analysis"),
    text.lastIndexOf("market analysis"),
    text.lastIndexOf("competitor_analysis")
  );
  const importIndex = text.lastIndexOf("=== mysql import");
  const cooldownIndex = text.lastIndexOf('"reason": "cooldown');

  let label = "等待开始";
  if (summaryIndex >= 0 && summaryIndex > lastItemIndex) {
    label = analysisIndex > summaryIndex ? "分析报告" : "下载完成";
    if (total != null) current = total;
  } else if (analysisIndex >= 0 && analysisIndex > lastItemIndex) {
    label = "分析报告";
  } else if (importIndex >= 0 && importIndex > lastItemIndex) {
    label = "清洗入库";
  } else if (cooldownIndex >= 0 && cooldownIndex > lastItemIndex) {
    label = "冷却等待";
  } else if (current != null) {
    label = "下载导出";
  }

  const detail = current != null && total != null
    ? `正在处理第 ${current}/${total} 个商品`
    : "等待脚本写入进度";
  const percent = current != null && total
    ? Math.min(100, Math.max(0, Math.round((current / total) * 100)))
    : null;

  return { current, total, label, detail, percent };
}
