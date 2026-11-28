import type { PrismaClient } from '@prisma/client';
import type { Config } from './config.js';

export const auditGeneration = Symbol('auditGeneration');
type GenerationEvent = {
  model: string;
  outcome: 'SUCCEEDED' | 'PROVIDER_ERROR';
  durationMs: number;
};
export type GenerationConfig = Config & {
  [auditGeneration]?: (event: GenerationEvent) => Promise<void>;
};

export function trackAi(config: Config, db: PrismaClient, userId: string, feature: string): GenerationConfig {
  return {
    ...config,
    async [auditGeneration](event) {
      try {
        await db.aiRequest.create({ data: { userId, feature, ...event } });
      } catch {
        // The request may finish after account deletion or during a transient database failure.
        console.error('AI request audit could not be persisted.');
      }
    },
  };
}
