-- CreateTable
CREATE TABLE "LangGraphCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "checkpointId" TEXT NOT NULL,
    "parentCheckpointId" TEXT,
    "checkpoint" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LangGraphCheckpoint_threadId_checkpointNs_checkpointId_key" ON "LangGraphCheckpoint"("threadId", "checkpointNs", "checkpointId");

-- CreateIndex
CREATE INDEX "LangGraphCheckpoint_threadId_idx" ON "LangGraphCheckpoint"("threadId");

-- CreateTable
CREATE TABLE "LangGraphCheckpointWrite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "checkpointId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "writeIdx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LangGraphCheckpointWrite_threadId_checkpointNs_checkpointId_t_taskId_writeIdx_key" ON "LangGraphCheckpointWrite"("threadId", "checkpointNs", "checkpointId", "taskId", "writeIdx");

-- CreateIndex
CREATE INDEX "LangGraphCheckpointWrite_threadId_idx" ON "LangGraphCheckpointWrite"("threadId");
