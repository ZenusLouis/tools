-- CreateTable
CREATE TABLE "BridgeProjectPath" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeProjectPath_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeProjectPath_workspaceId_projectName_deviceId_key" ON "BridgeProjectPath"("workspaceId", "projectName", "deviceId");

-- CreateIndex
CREATE INDEX "BridgeProjectPath_workspaceId_idx" ON "BridgeProjectPath"("workspaceId");

-- CreateIndex
CREATE INDEX "BridgeProjectPath_projectName_idx" ON "BridgeProjectPath"("projectName");

-- CreateIndex
CREATE INDEX "BridgeProjectPath_deviceId_idx" ON "BridgeProjectPath"("deviceId");

-- AddForeignKey
ALTER TABLE "BridgeProjectPath" ADD CONSTRAINT "BridgeProjectPath_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeProjectPath" ADD CONSTRAINT "BridgeProjectPath_projectName_fkey" FOREIGN KEY ("projectName") REFERENCES "Project"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeProjectPath" ADD CONSTRAINT "BridgeProjectPath_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BridgeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
