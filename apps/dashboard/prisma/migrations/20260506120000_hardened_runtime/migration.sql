-- Bridge action protocol v1 metadata.
ALTER TABLE "BridgeFileAction" ADD COLUMN "payloadVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BridgeFileAction" ADD COLUMN "resultVersion" INTEGER;
ALTER TABLE "BridgeFileAction" ADD COLUMN "actionType" TEXT;
ALTER TABLE "BridgeFileAction" ADD COLUMN "claimToken" TEXT;
ALTER TABLE "BridgeFileAction" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "BridgeFileAction" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "BridgeFileAction" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BridgeFileAction" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BridgeFileAction" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);

UPDATE "BridgeFileAction"
SET "actionType" = COALESCE("actionType", "type")
WHERE "actionType" IS NULL;

CREATE INDEX "BridgeFileAction_actionType_idx" ON "BridgeFileAction"("actionType");
CREATE INDEX "BridgeFileAction_leaseExpiresAt_idx" ON "BridgeFileAction"("leaseExpiresAt");
CREATE INDEX "BridgeFileAction_heartbeatAt_idx" ON "BridgeFileAction"("heartbeatAt");

-- Structured task/run telemetry. Raw action JSON stays available for audit/debug.
CREATE TABLE "RunTelemetry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionId" TEXT,
    "taskId" TEXT,
    "projectName" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "role" TEXT,
    "source" TEXT NOT NULL DEFAULT 'run_task',
    "optimizerMode" TEXT,
    "contextMode" TEXT,
    "selectedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "skillScores" JSONB NOT NULL DEFAULT '{}',
    "estimatedTokens" INTEGER,
    "actualTokens" INTEGER,
    "providerTokens" INTEGER,
    "codexCredits" DOUBLE PRECISION,
    "normalizedCostUsd" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunTelemetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RunTelemetry_workspaceId_idx" ON "RunTelemetry"("workspaceId");
CREATE INDEX "RunTelemetry_actionId_idx" ON "RunTelemetry"("actionId");
CREATE INDEX "RunTelemetry_taskId_idx" ON "RunTelemetry"("taskId");
CREATE INDEX "RunTelemetry_projectName_idx" ON "RunTelemetry"("projectName");
CREATE INDEX "RunTelemetry_provider_idx" ON "RunTelemetry"("provider");
CREATE INDEX "RunTelemetry_source_idx" ON "RunTelemetry"("source");
CREATE INDEX "RunTelemetry_createdAt_idx" ON "RunTelemetry"("createdAt");

ALTER TABLE "RunTelemetry" ADD CONSTRAINT "RunTelemetry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunTelemetry" ADD CONSTRAINT "RunTelemetry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BridgeFileAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DB-first import/export snapshots.
CREATE TABLE "SnapshotExport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectName" TEXT,
    "deviceId" TEXT,
    "kind" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT,
    "hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'exported',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SnapshotExport_workspaceId_idx" ON "SnapshotExport"("workspaceId");
CREATE INDEX "SnapshotExport_projectName_idx" ON "SnapshotExport"("projectName");
CREATE INDEX "SnapshotExport_deviceId_idx" ON "SnapshotExport"("deviceId");
CREATE INDEX "SnapshotExport_kind_idx" ON "SnapshotExport"("kind");
CREATE INDEX "SnapshotExport_exportedAt_idx" ON "SnapshotExport"("exportedAt");

ALTER TABLE "SnapshotExport" ADD CONSTRAINT "SnapshotExport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePath" TEXT,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conflictPolicy" TEXT NOT NULL DEFAULT 'db_wins',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_workspaceId_idx" ON "ImportJob"("workspaceId");
CREATE INDEX "ImportJob_sourceType_idx" ON "ImportJob"("sourceType");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Obsidian-style memory graph runtime.
CREATE TABLE "MemoryNode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectName" TEXT,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reqIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourcePath" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryNode_workspaceId_key_key" ON "MemoryNode"("workspaceId", "key");
CREATE INDEX "MemoryNode_workspaceId_idx" ON "MemoryNode"("workspaceId");
CREATE INDEX "MemoryNode_projectName_idx" ON "MemoryNode"("projectName");
CREATE INDEX "MemoryNode_kind_idx" ON "MemoryNode"("kind");

ALTER TABLE "MemoryNode" ADD CONSTRAINT "MemoryNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MemoryEdge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryEdge_workspaceId_fromNodeId_toNodeId_relation_key" ON "MemoryEdge"("workspaceId", "fromNodeId", "toNodeId", "relation");
CREATE INDEX "MemoryEdge_workspaceId_idx" ON "MemoryEdge"("workspaceId");
CREATE INDEX "MemoryEdge_fromNodeId_idx" ON "MemoryEdge"("fromNodeId");
CREATE INDEX "MemoryEdge_toNodeId_idx" ON "MemoryEdge"("toNodeId");
CREATE INDEX "MemoryEdge_relation_idx" ON "MemoryEdge"("relation");

ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "MemoryNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "MemoryNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security/audit trail.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "actionId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "event" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_actionId_idx" ON "AuditLog"("actionId");
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BridgeFileAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
