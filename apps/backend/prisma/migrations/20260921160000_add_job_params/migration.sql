-- Persist collection/analysis job input params (price range, topN, pages, autoParse)
ALTER TABLE `Job` ADD COLUMN `paramsJson` JSON NULL;
