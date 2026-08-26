import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { log } from './logger.js';
import { notify } from './notify.js';
import { ollamaGenerate } from './ollama.js';
import { render } from './template.js';
import type { LoadedWorkflow, RunContext, Step } from './types.js';

function stepLabel(step: Step, index: number): string {
  if (step.name) return step.name;
  if ('run' in step) return step.run;
  if ('http' in step) return `${step.http.method ?? 'GET'} ${step.http.url}`;
  if ('ollama' in step) return `Ollama: ${step.ollama.model ?? 'default model'}`;
  return 'Notification';
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
    const timeout = options.timeoutSeconds
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, options.timeoutSeconds * 1000)
      : undefined;

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (timeout) clearTimeout(timeout);
      if (timedOut) return reject(new Error(`Command timed out after ${options.timeoutSeconds}s`));
      if (code !== 0) return reject(new Error(`Command exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
      resolve(stdout.trim());
    });
  });
}

async function executeStep(step: Step, index: number, context: RunContext): Promise<void> {
  log.info(`Step ${index + 1}: ${stepLabel(step, index)}`);

  if ('run' in step) {
    const cwd = path.resolve(context.cwd, step.cwd ?? '.');
    const command = render(step.run, context.variables);
    const stepEnv = Object.fromEntries(
      Object.entries(step.env ?? {}).map(([key, value]) => [key, render(value, context.variables)]),
    );
    const output = await runCommand(command, {
      cwd,
      env: { ...process.env, ...stepEnv },
      ...(step.timeout_seconds ? { timeoutSeconds: step.timeout_seconds } : {}),
    });
    if (step.save_as) context.variables[step.save_as] = output;
    return;
  }

  if ('http' in step) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), (step.http.timeout_seconds ?? 30) * 1000);
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
      if (step.save_as) context.variables[step.save_as] = text;
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  if ('ollama' in step) {
    const host = step.ollama.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    const model = step.ollama.model ?? process.env.DESKCRON_OLLAMA_MODEL ?? 'qwen3:8b';
    const output = await ollamaGenerate({
      host,
      model,
      prompt: render(step.ollama.prompt, context.variables),
      ...(step.ollama.system ? { system: render(step.ollama.system, context.variables) } : {}),
    });
    console.log(output);
    if (step.save_as) context.variables[step.save_as] = output;
    return;
  }

  await notify(
    render(step.notify.title ?? 'DeskCron', context.variables),
    render(step.notify.message, context.variables),
  );
}

export async function runWorkflow(loaded: LoadedWorkflow): Promise<void> {
  const { workflow, filePath } = loaded;
  const context: RunContext = {
    cwd: process.cwd(),
    variables: { ...(workflow.env ?? {}) },
  };

  log.info(`Running ${workflow.name}`);
  const started = Date.now();

  for (let i = 0; i < workflow.steps.length; i += 1) {
    const step = workflow.steps[i];
    if (!step) continue;
    try {
      await executeStep(step, i, context);
      log.ok(`Step ${i + 1} completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (step.continue_on_error) {
        log.warn(`Step ${i + 1} failed but workflow continues: ${message}`);
        continue;
      }
      throw new Error(`Step ${i + 1} failed: ${message}`, { cause: error });
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  log.ok(`${workflow.name} completed in ${seconds}s`);
}
