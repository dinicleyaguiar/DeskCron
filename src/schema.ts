import { z } from 'zod';

const common = {
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  continue_on_error: z.boolean().optional(),
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
  timeout_seconds: z.number().positive().max(86400).optional(),
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

export const workflowSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  triggers: z.array(z.union([startupTrigger, cronTrigger])).optional(),
  env: z.record(z.string(), z.string()).optional(),
  steps: z.array(z.union([runStep, httpStep, ollamaStep, notifyStep])).min(1),
});

