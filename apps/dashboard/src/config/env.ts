import { z } from "zod";

const envSchema = z.object({
  CLAUDE_ROOT: z.string().default("d:\\GlobalClaudeSkills"),
});

export const env = envSchema.parse(process.env);
