-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "TaskPhase" AS ENUM ('pending', 'analysis', 'ready_for_dev', 'implementation', 'review', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "AgentProvider" AS ENUM ('claude', 'codex', 'chatgpt');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('local', 'dashboard');

-- CreateEnum
CREATE TYPE "RolePhase" AS ENUM ('analysis', 'implementation', 'review', 'research', 'design', 'custom');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateTable
CREATE TABLE "Project" (
    "name" TEXT NOT NULL,
    "workspaceId" TEXT,
    "path" TEXT,
    "frameworks" TEXT[],
    "lastIndexed" TIMESTAMP(3),
    "activeTask" TEXT,
    "links" JSONB NOT NULL DEFAULT '{}',
    "docs" JSONB NOT NULL DEFAULT '{}',
    "mcpProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "featureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "estimate" TEXT,
    "deps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phase" "TaskPhase",
    "baRoleId" TEXT,
    "devRoleId" TEXT,
    "reviewRoleId" TEXT,
    "analysisBriefPath" TEXT,
    "implementationLogPath" TEXT,
    "reviewPath" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeDevice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "claudeAvailable" BOOLEAN NOT NULL DEFAULT false,
    "codexAvailable" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "BridgeDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourcePath" TEXT,
    "description" TEXT NOT NULL,
    "providerCompatibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleCompatibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "provider" "AgentProvider" NOT NULL,
    "defaultModel" TEXT,
    "phase" "RolePhase" NOT NULL,
    "executionModeDefault" "ExecutionMode" NOT NULL DEFAULT 'local',
    "credentialService" TEXT NOT NULL DEFAULT 'none',
    "roleType" TEXT NOT NULL DEFAULT 'custom',
    "rulesMarkdown" TEXT NOT NULL DEFAULT '',
    "mcpProfile" TEXT,
    "generatedPaths" JSONB NOT NULL DEFAULT '{}',
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "agentRoleId" TEXT,
    "provider" "AgentProvider",
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "deviceId" TEXT,
    "provider" "AgentProvider" NOT NULL DEFAULT 'claude',
    "role" TEXT,
    "model" TEXT,
    "transcriptPath" TEXT,
    "cwd" TEXT,
    "type" TEXT NOT NULL DEFAULT 'session',
    "project" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tasksCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commitHash" TEXT,
    "sessionNotes" TEXT,
    "totalTokens" INTEGER,
    "totalCostUSD" DOUBLE PRECISION,
    "durationMin" DOUBLE PRECISION,
    "filesChanged" JSONB,
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lessonSaved" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "deviceId" TEXT,
    "provider" "AgentProvider" NOT NULL DEFAULT 'claude',
    "role" TEXT,
    "model" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "tool" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "decisionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpServer" (
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headers" JSONB,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "McpProfile" (
    "profile" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servers" TEXT[],
    "useWhen" TEXT NOT NULL,

    CONSTRAINT "McpProfile_pkey" PRIMARY KEY ("profile")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgentRoleSkills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AgentRoleSkills_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Module_projectName_idx" ON "Module"("projectName");

-- CreateIndex
CREATE INDEX "Feature_moduleId_idx" ON "Feature"("moduleId");

-- CreateIndex
CREATE INDEX "Task_featureId_idx" ON "Task"("featureId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- CreateIndex
CREATE INDEX "Task_phase_idx" ON "Task"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "BridgeDevice_workspaceId_idx" ON "BridgeDevice"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeDevice_workspaceId_deviceKey_key" ON "BridgeDevice"("workspaceId", "deviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeToken_tokenHash_key" ON "BridgeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BridgeToken_workspaceId_idx" ON "BridgeToken"("workspaceId");

-- CreateIndex
CREATE INDEX "BridgeToken_deviceId_idx" ON "BridgeToken"("deviceId");

-- CreateIndex
CREATE INDEX "SkillDefinition_workspaceId_idx" ON "SkillDefinition"("workspaceId");

-- CreateIndex
CREATE INDEX "SkillDefinition_category_idx" ON "SkillDefinition"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDefinition_workspaceId_slug_key" ON "SkillDefinition"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "AgentRole_workspaceId_idx" ON "AgentRole"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentRole_provider_idx" ON "AgentRole"("provider");

-- CreateIndex
CREATE INDEX "AgentRole_phase_idx" ON "AgentRole"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRole_workspaceId_slug_key" ON "AgentRole"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "ChatSession_workspaceId_idx" ON "ChatSession"("workspaceId");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatSession_agentRoleId_idx" ON "ChatSession"("agentRoleId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "Session_project_idx" ON "Session"("project");

-- CreateIndex
CREATE INDEX "Session_date_idx" ON "Session"("date");

-- CreateIndex
CREATE INDEX "Session_workspaceId_idx" ON "Session"("workspaceId");

-- CreateIndex
CREATE INDEX "Session_provider_idx" ON "Session"("provider");

-- CreateIndex
CREATE INDEX "Session_role_idx" ON "Session"("role");

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "ToolUsage_date_idx" ON "ToolUsage"("date");

-- CreateIndex
CREATE INDEX "ToolUsage_tool_idx" ON "ToolUsage"("tool");

-- CreateIndex
CREATE INDEX "ToolUsage_workspaceId_idx" ON "ToolUsage"("workspaceId");

-- CreateIndex
CREATE INDEX "ToolUsage_provider_idx" ON "ToolUsage"("provider");

-- CreateIndex
CREATE INDEX "ToolUsage_role_idx" ON "ToolUsage"("role");

-- CreateIndex
CREATE INDEX "ToolUsage_deviceId_idx" ON "ToolUsage"("deviceId");

-- CreateIndex
CREATE INDEX "Lesson_framework_idx" ON "Lesson"("framework");

-- CreateIndex
CREATE INDEX "Decision_projectName_idx" ON "Decision"("projectName");

-- CreateIndex
CREATE INDEX "ApiKey_service_idx" ON "ApiKey"("service");

-- CreateIndex
CREATE INDEX "ApiKey_workspaceId_idx" ON "ApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "_AgentRoleSkills_B_index" ON "_AgentRoleSkills"("B");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_projectName_fkey" FOREIGN KEY ("projectName") REFERENCES "Project"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_baRoleId_fkey" FOREIGN KEY ("baRoleId") REFERENCES "AgentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_devRoleId_fkey" FOREIGN KEY ("devRoleId") REFERENCES "AgentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewRoleId_fkey" FOREIGN KEY ("reviewRoleId") REFERENCES "AgentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeDevice" ADD CONSTRAINT "BridgeDevice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeToken" ADD CONSTRAINT "BridgeToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeToken" ADD CONSTRAINT "BridgeToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BridgeDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDefinition" ADD CONSTRAINT "SkillDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRole" ADD CONSTRAINT "AgentRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_agentRoleId_fkey" FOREIGN KEY ("agentRoleId") REFERENCES "AgentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolUsage" ADD CONSTRAINT "ToolUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_projectName_fkey" FOREIGN KEY ("projectName") REFERENCES "Project"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentRoleSkills" ADD CONSTRAINT "_AgentRoleSkills_A_fkey" FOREIGN KEY ("A") REFERENCES "AgentRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentRoleSkills" ADD CONSTRAINT "_AgentRoleSkills_B_fkey" FOREIGN KEY ("B") REFERENCES "SkillDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
