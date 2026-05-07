-- Skill brain v2 source metadata and compact guidance.
ALTER TABLE "SkillDefinition" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "SkillDefinition" ADD COLUMN "sourcePriority" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "SkillDefinition" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "SkillDefinition" ADD COLUMN "importMode" TEXT;
ALTER TABLE "SkillDefinition" ADD COLUMN "trustedSourceSlug" TEXT;
ALTER TABLE "SkillDefinition" ADD COLUMN "compactGuidance" TEXT;
ALTER TABLE "SkillDefinition" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "SkillDefinition_sourceType_idx" ON "SkillDefinition"("sourceType");
CREATE INDEX "SkillDefinition_contentHash_idx" ON "SkillDefinition"("contentHash");
