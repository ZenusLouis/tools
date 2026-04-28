-- CreateTable
CREATE TABLE "BridgeFileAction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeFileAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BridgeFileAction_workspaceId_idx" ON "BridgeFileAction"("workspaceId");

-- CreateIndex
CREATE INDEX "BridgeFileAction_deviceId_idx" ON "BridgeFileAction"("deviceId");

-- CreateIndex
CREATE INDEX "BridgeFileAction_status_idx" ON "BridgeFileAction"("status");

-- CreateIndex
CREATE INDEX "BridgeFileAction_type_idx" ON "BridgeFileAction"("type");

-- CreateIndex
CREATE INDEX "BridgeFileAction_createdAt_idx" ON "BridgeFileAction"("createdAt");

-- AddForeignKey
ALTER TABLE "BridgeFileAction" ADD CONSTRAINT "BridgeFileAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeFileAction" ADD CONSTRAINT "BridgeFileAction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BridgeDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
