-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "checkpointStage" TEXT,
    "parentJobId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "providerProfileId" TEXT,
    "paramsJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "claimDeadline" DATETIME,
    "nextRetryAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CollectionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "storeId" TEXT,
    "keyword" TEXT,
    "rawResultJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceFileRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "collectionJobId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT,
    "sha256" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "collectionJobId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "title" TEXT,
    "price" REAL,
    "shopId" TEXT,
    "shopName" TEXT,
    "snapshotTime" DATETIME NOT NULL,
    "dataSnapshotDate" TEXT NOT NULL,
    "rawJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductSkuSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSnapshotId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "name" TEXT,
    "price" REAL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductQaSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSnapshotId" TEXT NOT NULL,
    "question" TEXT,
    "answer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductReviewSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSnapshotId" TEXT NOT NULL,
    "content" TEXT,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "storeId" TEXT,
    "keyword" TEXT,
    "analysisType" TEXT NOT NULL,
    "reportNo" TEXT,
    "reportHash" TEXT,
    "status" TEXT NOT NULL,
    "competitorCount" INTEGER,
    "costModelJson" JSONB,
    "reportJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalysisPriceBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisRunId" TEXT NOT NULL,
    "bandName" TEXT NOT NULL,
    "priceMin" REAL,
    "priceMax" REAL,
    "productCount" INTEGER NOT NULL,
    "analysisStatus" TEXT NOT NULL DEFAULT 'raw',
    "sellingPointsJson" JSONB,
    "demandsJson" JSONB,
    "imagePromptsJson" JSONB,
    "profitSimulationJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisBandProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priceBandId" TEXT NOT NULL,
    "productSnapshotId" TEXT,
    "externalProductId" TEXT,
    "title" TEXT,
    "price" REAL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisBandImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priceBandId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "storageKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisProductAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisRunId" TEXT NOT NULL,
    "productSnapshotId" TEXT,
    "productTitle" TEXT,
    "analysisJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MainImageAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisRunId" TEXT NOT NULL,
    "productId" TEXT,
    "imageUrl" TEXT,
    "storageKey" TEXT,
    "visionModel" TEXT,
    "prompt" TEXT,
    "resultJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ListingDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "analysisRunId" TEXT,
    "platformId" TEXT,
    "title" TEXT,
    "contentJson" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT,
    "sourceUrl" TEXT,
    "originalName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "analysisRunId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT,
    "originalName" TEXT,
    "sourceUrl" TEXT,
    "runId" TEXT,
    "category" TEXT,
    "prompt" TEXT,
    "ratio" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "createdBy" TEXT,
    "platform" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "platform" TEXT,
    "version" TEXT,
    "capabilitiesJson" JSONB,
    "deviceSecretHash" TEXT,
    "status" TEXT NOT NULL,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leaseUntil" DATETIME,
    "heartbeatAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assetId" TEXT,
    "reviewType" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "attemptKey" TEXT NOT NULL,
    "providerProfileId" TEXT,
    "providerType" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "tokenIn" INTEGER,
    "tokenOut" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiCallCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "model" TEXT,
    "resultJson" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyRef" TEXT NOT NULL,
    "capabilitiesJson" JSONB,
    "modelConfigJson" JSONB,
    "timeoutMs" INTEGER,
    "retryPolicyJson" JSONB,
    "limitsJson" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "productImage" TEXT,
    "storeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "specName" TEXT,
    "specImage" TEXT,
    "costPrice" REAL,
    "standardPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_businessKey_key" ON "Job"("businessKey");

-- CreateIndex
CREATE INDEX "Job_tenantId_status_type_idx" ON "Job"("tenantId", "status", "type");

-- CreateIndex
CREATE INDEX "Job_tenantId_createdAt_idx" ON "Job"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionJob_jobId_key" ON "CollectionJob"("jobId");

-- CreateIndex
CREATE INDEX "CollectionJob_tenantId_status_idx" ON "CollectionJob"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFileRecord_storageKey_key" ON "SourceFileRecord"("storageKey");

-- CreateIndex
CREATE INDEX "SourceFileRecord_tenantId_collectionJobId_idx" ON "SourceFileRecord"("tenantId", "collectionJobId");

-- CreateIndex
CREATE INDEX "ProductSnapshot_tenantId_snapshotTime_idx" ON "ProductSnapshot"("tenantId", "snapshotTime");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSnapshot_collectionJobId_externalProductId_key" ON "ProductSnapshot"("collectionJobId", "externalProductId");

-- CreateIndex
CREATE INDEX "ProductSkuSnapshot_productSnapshotId_idx" ON "ProductSkuSnapshot"("productSnapshotId");

-- CreateIndex
CREATE INDEX "ProductQaSnapshot_productSnapshotId_idx" ON "ProductQaSnapshot"("productSnapshotId");

-- CreateIndex
CREATE INDEX "ProductReviewSnapshot_productSnapshotId_idx" ON "ProductReviewSnapshot"("productSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisRun_jobId_key" ON "AnalysisRun"("jobId");

-- CreateIndex
CREATE INDEX "AnalysisRun_tenantId_status_idx" ON "AnalysisRun"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AnalysisPriceBand_analysisRunId_idx" ON "AnalysisPriceBand"("analysisRunId");

-- CreateIndex
CREATE INDEX "AnalysisBandProduct_priceBandId_idx" ON "AnalysisBandProduct"("priceBandId");

-- CreateIndex
CREATE INDEX "AnalysisBandImage_priceBandId_idx" ON "AnalysisBandImage"("priceBandId");

-- CreateIndex
CREATE INDEX "AnalysisProductAnalysis_analysisRunId_idx" ON "AnalysisProductAnalysis"("analysisRunId");

-- CreateIndex
CREATE INDEX "AnalysisInsight_analysisRunId_idx" ON "AnalysisInsight"("analysisRunId");

-- CreateIndex
CREATE INDEX "MainImageAnalysis_analysisRunId_idx" ON "MainImageAnalysis"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingDraft_jobId_key" ON "ListingDraft"("jobId");

-- CreateIndex
CREATE INDEX "ListingDraft_tenantId_status_idx" ON "ListingDraft"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_createdAt_idx" ON "MediaAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAsset_storageKey_key" ON "GeneratedAsset"("storageKey");

-- CreateIndex
CREATE INDEX "GeneratedAsset_tenantId_createdAt_idx" ON "GeneratedAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Agent_tenantId_status_idx" ON "Agent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AgentAssignment_jobId_idx" ON "AgentAssignment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAssignment_agentId_jobId_key" ON "AgentAssignment"("agentId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAssignment_jobId_key" ON "AgentAssignment"("jobId");

-- CreateIndex
CREATE INDEX "ReviewRecord_tenantId_decision_idx" ON "ReviewRecord"("tenantId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageLog_attemptKey_key" ON "AiUsageLog"("attemptKey");

-- CreateIndex
CREATE INDEX "AiUsageLog_tenantId_createdAt_idx" ON "AiUsageLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiCallCache_requestHash_key" ON "AiCallCache"("requestHash");

-- CreateIndex
CREATE INDEX "AiCallCache_tenantId_idx" ON "AiCallCache"("tenantId");

-- CreateIndex
CREATE INDEX "ProviderProfile_tenantId_enabled_idx" ON "ProviderProfile"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "Product_tenantId_status_idx" ON "Product"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Product_tenantId_storeId_idx" ON "Product"("tenantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_productCode_key" ON "Product"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "ProductSku_productId_idx" ON "ProductSku"("productId");

