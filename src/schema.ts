import { z } from 'zod';
import { validateCondition } from './condition.js';

const retry = z.object({
  attempts: z.number().int().min(1).max(10),
  delay_seconds: z.number().min(0).max(3600).optional(),
  backoff: z.number().min(1).max(10).optional(),
  max_delay_seconds: z.number().min(0).max(86400).optional(),
});

const common = {
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'Use letters, numbers, _ or -, starting with a letter').optional(),
  name: z.string().min(1).optional(),
  if: z.string().min(1).optional(),
  needs: z.array(z.string().min(1)).min(1).optional(),
  continue_on_error: z.boolean().optional(),
  retry: retry.optional(),
  timeout_seconds: z.number().positive().max(86400).optional(),
};

const startupTrigger = z.object({
  type: z.literal('startup'),
});

const cronTrigger = z.object({
  type: z.literal('cron'),
  expression: z.string().min(1),
  timezone: z.string().min(1).optional(),
});

const runStep = z.object({
  ...common,
  run: z.string().min(1),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  save_as: z.string().min(1).optional(),
});

const httpStep = z.object({
  ...common,
  http: z.object({
    url: z.string().url(),
    method: z.string().min(1).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    expect_status: z.array(z.number().int().min(100).max(599)).min(1).optional(),
    timeout_seconds: z.number().positive().max(86400).optional(),
  }),
  save_as: z.string().min(1).optional(),
});

const ollamaStep = z.object({
  ...common,
  ollama: z.object({
    prompt: z.string().min(1),
    model: z.string().min(1).optional(),
    host: z.string().url().optional(),
    system: z.string().optional(),
  }),
  save_as: z.string().min(1).optional(),
});

const notifyStep = z.object({
  ...common,
  notify: z.object({
    title: z.string().min(1).optional(),
    message: z.string().min(1),
  }),
});

const stepSchema = z.union([runStep, httpStep, ollamaStep, notifyStep]);

export const workflowSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  triggers: z.array(z.union([startupTrigger, cronTrigger])).optional(),
  env: z.record(z.string(), z.string()).optional(),
  steps: z.array(stepSchema).min(1),
}).superRefine((workflow, ctx) => {
  const seen = new Set<string>();

  workflow.steps.forEach((step, index) => {
    if (step.id && seen.has(step.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps', index, 'id'],
        message: `Duplicate step id: ${step.id}`,
      });
    }

    if (step.needs) {
      for (const dependency of step.needs) {
        if (!seen.has(dependency)) {
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'needs'],
            message: `Dependency ${dependency} must reference an earlier step id`,
          });
        }
      }
    }

    if (step.id) seen.add(step.id);

    if (step.if) {
      try {
        validateCondition(step.if);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'if'],
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
});
