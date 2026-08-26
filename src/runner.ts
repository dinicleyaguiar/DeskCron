import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { evaluateCondition } from './condition.js';
import { appendHistory } from './history.js';
import { formatDuration, log } from './logger.js';
import { notify } from './notify.js';
import { ollamaGenerate } from './ollama.js';
import { render } from './template.js';
import type {
  LoadedWorkflow,
  RunContext,
  RunOptions,
  Step,
  StepResult,
  WorkflowRunRecord,
  WorkflowRunStatus,
} from './types.js';

function stepType(step: Step): StepResult['type'] {
  if ('run' in step) return 'run';
  if ('http' in step) return 'http';
  if ('ollama' in step) return 'ollama';
  return 'notify';
}

function stepLabel(step: Step, index: number): string {
  if (step.name) return step.name;
  if ('run' in step) return step.run;
  if ('http' in step) return `${step.http.method ?? 'GET'} ${step.http.url}`;
  if ('ollama' in step) return `Ollama: ${step.ollama.model ?? 'default model'}`;
  return 'Notification';
}

function resultId(step: Step, index: number): string {
  return step.id ?? `step-${index + 1}`;
}

function safeHistoryError(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function terminateProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('error', () => resolve());
      killer.once('close', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
  await sleep(750);
  child.kill('SIGKILL');
}

async function runCommand(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutSeconds?: number },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: options.env,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      callback();
    };

    const timeout = options.timeoutSeconds
      ? setTimeout(() => {
          timedOut = true;
          void terminateProcess(child).finally(() => {
            finish(() => reject(new Error(`Command timed out after ${options.timeoutSeconds}s`)));
          });
        }, options.timeoutSeconds * 1000)
      : undefined;

    child.stdout?.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr?.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.once('error', (error) => finish(() => reject(error)));
    child.once('close', (code) => {
      if (timeout) clearTimeout(timeout);
      finish(() => {
        if (timedOut) {
          reject(new Error(`Command timed out after ${options.timeoutSeconds}s`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`Command exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  });
}

async function withTimeout<T>(promise: Promise<T>, seconds: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${seconds}s`)), seconds * 1000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeStep(step: Step, context: RunContext): Promise<string | undefined> {
  if ('run' in step) {
    const cwd = path.resolve(context.cwd, step.cwd ?? '.');
    const command = render(step.run, context.variables);
    const stepEnv = Object.fromEntries(
      Object.entries(step.env ?? {}).map(([key, value]) => [key, render(value, context.variables)]),
    );
    return runCommand(command, {
      cwd,
      env: { ...process.env, ...stepEnv },
      ...(step.timeout_seconds ? { timeoutSeconds: step.timeout_seconds } : {}),
    });
  }

  if ('http' in step) {
    const controller = new AbortController();
    const timeoutSeconds = step.timeout_seconds ?? step.http.timeout_seconds ?? 30;
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
      const method = (step.http.method ?? 'GET').toUpperCase();
      const headers = Object.fromEntries(
        Object.entries(step.http.headers ?? {}).map(([key, value]) => [key, render(value, context.variables)]),
      );
      const body = step.http.body === undefined ? undefined : render(step.http.body, context.variables);
      const response = await fetch(render(step.http.url, context.variables), {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });
      const expected = step.http.expect_status ?? [200, 201, 202, 204];
      const text = await response.text();
      if (!expected.includes(response.status)) {
        throw new Error(`HTTP ${response.status}; expected ${expected.join(', ')}`);
      }
      return text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeoutSeconds}s`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  if ('ollama' in step) {
    const host = step.ollama.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    const model = step.ollama.model ?? process.env.DESKCRON_OLLAMA_MODEL ?? 'qwen3:8b';
    const output = await ollamaGenerate({
      host,
      model,
      prompt: render(step.ollama.prompt, context.variables),
      ...(step.ollama.system ? { system: render(step.ollama.system, context.variables) } : {}),
      ...(step.timeout_seconds ? { timeoutSeconds: step.timeout_seconds } : {}),
    });
    console.log(output);
    return output;
  }

  const timeoutSeconds = step.timeout_seconds ?? 15;
  await withTimeout(
    notify(
      render(step.notify.title ?? 'DeskCron', context.variables),
      render(step.notify.message, context.variables),
    ),
    timeoutSeconds,
    'Notification',
  );
  return undefined;
}

function dependenciesSatisfied(step: Step, context: RunContext): { ok: boolean; reason?: string } {
  if (!step.needs?.length) return { ok: true };
  for (const dependency of step.needs) {
    const result = context.stepResults[dependency];
    if (!result || result.status !== 'success') {
      return { ok: false, reason: `dependency ${dependency} is ${result?.status ?? 'missing'}` };
    }
  }
  return { ok: true };
}

function retryDelayMilliseconds(step: Step, failedAttempt: number): number {
  const policy = step.retry;
  if (!policy) return 0;
  const base = policy.delay_seconds ?? 1;
  const backoff = policy.backoff ?? 1;
  const max = policy.max_delay_seconds ?? 300;
  return Math.round(Math.min(base * Math.pow(backoff, Math.max(0, failedAttempt - 1)), max) * 1000);
}

async function runStepWithRetries(
  step: Step,
  index: number,
  context: RunContext,
): Promise<{ attempts: number; output?: string }> {
  const maxAttempts = step.retry?.attempts ?? 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const output = await executeStep(step, context);
      return output === undefined ? { attempts: attempt } : { attempts: attempt, output };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delayMs = retryDelayMilliseconds(step, attempt);
      log.retry(
        `Step ${index + 1} attempt ${attempt}/${maxAttempts} failed; retrying in ${formatDuration(delayMs)}`,
      );
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function plannedResult(step: Step, index: number): StepResult {
  return {
    id: resultId(step, index),
    index: index + 1,
    name: stepLabel(step, index),
    type: stepType(step),
    status: 'planned',
    attempts: 0,
    duration_ms: 0,
  };
}

export async function runWorkflow(
  loaded: LoadedWorkflow,
  options: RunOptions = {},
): Promise<WorkflowRunRecord> {
  const { workflow, filePath } = loaded;
  const startedAt = new Date();
  const started = Date.now();
  const dryRun = options.dryRun ?? false;
  const recordHistory = options.recordHistory ?? !dryRun;
  const context: RunContext = {
    cwd: process.cwd(),
    variables: { ...(workflow.env ?? {}) },
    stepResults: {},
    hadFailure: false,
    dryRun,
  };
  const results: StepResult[] = [];
  let fatalError: Error | undefined;

  log.run(`${workflow.name}${dryRun ? ' [dry-run]' : ''}`);

  if (dryRun) {
    workflow.steps.forEach((step, index) => {
      const result = plannedResult(step, index);
      results.push(result);
      log.step(`${index + 1}/${workflow.steps.length} ${result.name}`);
      if (step.needs?.length) log.info(`needs: ${step.needs.join(', ')}`);
      if (step.if) log.info(`if: ${step.if}`);
      if (step.retry) log.info(`retry: ${step.retry.attempts} attempt(s)`);
    });
  } else {
    for (let index = 0; index < workflow.steps.length; index += 1) {
      const step = workflow.steps[index];
      if (!step) continue;
      const id = resultId(step, index);
      const name = stepLabel(step, index);
      const base: Omit<StepResult, 'status' | 'attempts' | 'duration_ms'> = {
        id,
        index: index + 1,
        name,
        type: stepType(step),
      };

      const dependencyCheck = dependenciesSatisfied(step, context);
      if (!dependencyCheck.ok) {
        const result: StepResult = { ...base, status: 'skipped', attempts: 0, duration_ms: 0 };
        context.stepResults[id] = result;
        results.push(result);
        log.skip(`Step ${index + 1}/${workflow.steps.length} ${name} (${dependencyCheck.reason})`);
        continue;
      }

      if (step.if && !evaluateCondition(step.if, context)) {
        const result: StepResult = { ...base, status: 'skipped', attempts: 0, duration_ms: 0 };
        context.stepResults[id] = result;
        results.push(result);
        log.skip(`Step ${index + 1}/${workflow.steps.length} ${name} (condition false)`);
        continue;
      }

      log.step(`${index + 1}/${workflow.steps.length} ${name}`);
      const stepStarted = Date.now();

      try {
        const { attempts, output } = await runStepWithRetries(step, index, context);
        if ('save_as' in step && step.save_as && output !== undefined) {
          context.variables[step.save_as] = output;
        }
        const result: StepResult = {
          ...base,
          status: 'success',
          attempts,
          duration_ms: Date.now() - stepStarted,
        };
        context.stepResults[id] = result;
        results.push(result);
        log.success(`Step ${index + 1} completed in ${formatDuration(result.duration_ms)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result: StepResult = {
          ...base,
          status: 'failed',
          attempts: step.retry?.attempts ?? 1,
          duration_ms: Date.now() - stepStarted,
          error: safeHistoryError(message),
        };
        context.stepResults[id] = result;
        results.push(result);
        context.hadFailure = true;

        if (step.continue_on_error) {
          log.warn(`Step ${index + 1} failed but workflow continues: ${message}`);
          continue;
        }

        fatalError = new Error(`Step ${index + 1} failed: ${message}`, { cause: error });
        log.error(fatalError.message);
        break;
      }
    }
  }

  const finishedAt = new Date();
  let status: WorkflowRunStatus;
  if (dryRun) status = 'dry-run';
  else if (fatalError) status = 'failed';
  else if (context.hadFailure) status = 'partial';
  else status = 'success';

  const record: WorkflowRunRecord = {
    id: crypto.randomUUID(),
    workflow: workflow.name,
    file: filePath,
    cwd: context.cwd,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: Date.now() - started,
    status,
    dry_run: dryRun,
    steps: results,
  };

  if (recordHistory) {
    try {
      await appendHistory(record, context.cwd);
    } catch (error) {
      log.warn(`Could not write run history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (fatalError) throw fatalError;

  log.success(`${workflow.name} ${status} in ${formatDuration(record.duration_ms)}`);
  return record;
}
