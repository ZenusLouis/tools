-- Add project, taskId, durationSec to ToolUsage
ALTER TABLE "ToolUsage" ADD COLUMN "project" TEXT;
ALTER TABLE "ToolUsage" ADD COLUMN "taskId" TEXT;
ALTER TABLE "ToolUsage" ADD COLUMN "durationSec" DOUBLE PRECISION;

CREATE INDEX "ToolUsage_project_idx" ON "ToolUsage"("project");
