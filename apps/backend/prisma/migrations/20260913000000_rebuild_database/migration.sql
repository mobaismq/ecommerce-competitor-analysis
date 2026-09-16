-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Department_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `dataScope` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `User_tenantId_isActive_idx`(`tenantId`, `isActive`),
    UNIQUE INDEX `User_tenantId_username_key`(`tenantId`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleStore` (
    `roleId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `storeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Platform` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Platform_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Store` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `platformId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `authExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Store_tenantId_platformId_idx`(`tenantId`, `platformId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `businessKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NULL,
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `checkpointStage` VARCHAR(191) NULL,
    `parentJobId` VARCHAR(191) NULL,
    `agentId` VARCHAR(191) NULL,
    `providerProfileId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `claimDeadline` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Job_businessKey_key`(`businessKey`),
    INDEX `Job_tenantId_status_type_idx`(`tenantId`, `status`, `type`),
    INDEX `Job_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobEvent` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobEvent_jobId_createdAt_idx`(`jobId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionJob` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NULL,
    `keyword` VARCHAR(191) NULL,
    `rawResultJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CollectionJob_jobId_key`(`jobId`),
    INDEX `CollectionJob_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SourceFileRecord` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `collectionJobId` VARCHAR(191) NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NULL,
    `sha256` VARCHAR(191) NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SourceFileRecord_storageKey_key`(`storageKey`),
    INDEX `SourceFileRecord_tenantId_collectionJobId_idx`(`tenantId`, `collectionJobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `collectionJobId` VARCHAR(191) NOT NULL,
    `externalProductId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NULL,
    `shopId` VARCHAR(191) NULL,
    `shopName` VARCHAR(191) NULL,
    `snapshotTime` DATETIME(3) NOT NULL,
    `dataSnapshotDate` VARCHAR(191) NOT NULL,
    `rawJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductSnapshot_tenantId_snapshotTime_idx`(`tenantId`, `snapshotTime`),
    UNIQUE INDEX `ProductSnapshot_collectionJobId_externalProductId_key`(`collectionJobId`, `externalProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSkuSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `productSnapshotId` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductSkuSnapshot_productSnapshotId_idx`(`productSnapshotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductQaSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `productSnapshotId` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NULL,
    `answer` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductQaSnapshot_productSnapshotId_idx`(`productSnapshotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductReviewSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `productSnapshotId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `rating` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductReviewSnapshot_productSnapshotId_idx`(`productSnapshotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisRun` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NULL,
    `keyword` VARCHAR(191) NULL,
    `analysisType` VARCHAR(191) NOT NULL,
    `reportNo` VARCHAR(191) NULL,
    `reportHash` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `competitorCount` INTEGER NULL,
    `costModelJson` JSON NULL,
    `reportJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AnalysisRun_jobId_key`(`jobId`),
    INDEX `AnalysisRun_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisPriceBand` (
    `id` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NOT NULL,
    `bandName` VARCHAR(191) NOT NULL,
    `priceMin` DECIMAL(12, 2) NULL,
    `priceMax` DECIMAL(12, 2) NULL,
    `productCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisPriceBand_analysisRunId_idx`(`analysisRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisBandProduct` (
    `id` VARCHAR(191) NOT NULL,
    `priceBandId` VARCHAR(191) NOT NULL,
    `productSnapshotId` VARCHAR(191) NULL,
    `externalProductId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisBandProduct_priceBandId_idx`(`priceBandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisBandImage` (
    `id` VARCHAR(191) NOT NULL,
    `priceBandId` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `storageKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisBandImage_priceBandId_idx`(`priceBandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisProductAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NOT NULL,
    `productSnapshotId` VARCHAR(191) NULL,
    `productTitle` VARCHAR(191) NULL,
    `analysisJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisProductAnalysis_analysisRunId_idx`(`analysisRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisInsight` (
    `id` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisInsight_analysisRunId_idx`(`analysisRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MainImageAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `storageKey` VARCHAR(191) NULL,
    `visionModel` VARCHAR(191) NULL,
    `prompt` VARCHAR(191) NULL,
    `resultJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MainImageAnalysis_analysisRunId_idx`(`analysisRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListingDraft` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NULL,
    `platformId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `contentJson` JSON NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ListingDraft_jobId_key`(`jobId`),
    INDEX `ListingDraft_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `originalName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedAsset` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NULL,
    `analysisRunId` VARCHAR(191) NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NULL,
    `originalName` VARCHAR(191) NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `runId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GeneratedAsset_storageKey_key`(`storageKey`),
    INDEX `GeneratedAsset_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NULL,
    `version` VARCHAR(191) NULL,
    `capabilitiesJson` JSON NULL,
    `deviceSecretHash` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Agent_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `leaseUntil` DATETIME(3) NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentAssignment_jobId_idx`(`jobId`),
    UNIQUE INDEX `AgentAssignment_agentId_jobId_key`(`agentId`, `jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewRecord` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NULL,
    `reviewType` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReviewRecord_tenantId_decision_idx`(`tenantId`, `decision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NULL,
    `attemptKey` VARCHAR(191) NOT NULL,
    `providerProfileId` VARCHAR(191) NULL,
    `providerType` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `tokenIn` INTEGER NULL,
    `tokenOut` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AiUsageLog_attemptKey_key`(`attemptKey`),
    INDEX `AiUsageLog_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiCallCache` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestHash` VARCHAR(191) NOT NULL,
    `providerType` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `resultJson` JSON NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiCallCache_requestHash_key`(`requestHash`),
    INDEX `AiCallCache_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderProfile` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `baseUrl` VARCHAR(191) NULL,
    `apiKeyRef` VARCHAR(191) NOT NULL,
    `capabilitiesJson` JSON NULL,
    `modelConfigJson` JSON NULL,
    `timeoutMs` INTEGER NULL,
    `retryPolicyJson` JSON NULL,
    `limitsJson` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `healthStatus` VARCHAR(191) NULL,
    `lastError` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProviderProfile_tenantId_enabled_idx`(`tenantId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

