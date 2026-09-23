-- 1.22/1.23 价格段 AI 分析状态与产物（对照旧版 market_price_band_analysis 的 selling_points/demands/image_prompts/profit_simulation）
ALTER TABLE `AnalysisPriceBand`
  ADD COLUMN `analysisStatus` VARCHAR(32) NOT NULL DEFAULT 'raw',
  ADD COLUMN `sellingPointsJson` JSON NULL,
  ADD COLUMN `demandsJson` JSON NULL,
  ADD COLUMN `imagePromptsJson` JSON NULL,
  ADD COLUMN `profitSimulationJson` JSON NULL;
