import cron from 'node-cron';
import { loadWorkflows } from './config.js';
import { log } from './logger.js';
import { runWorkflow } from './runner.js';
import type { LoadedWorkflow } from './types.js';

const running = new Set<string>();

async function safeRun(loaded: LoadedWorkflow): Promise<void> {
  if (running.has(loaded.filePath)) {
    log.warn(`Skipping overlapping run: ${loaded.workflow.name}`);
    return;
  }

  running.add(loaded.filePath);
  try {
    await runWorkflow(loaded);
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
  } finally {
    running.delete(loaded.filePath);
  }
}

export async function watchWorkflows(directory: string): Promise<void> {
  const workflows = await loadWorkflows(directory);
  if (workflows.length === 0) {
    throw new Error(`No workflows found in ${directory}. Run "deskcron init" first.`);
  }

  let schedules = 0;
  let startupRuns = 0;

  for (const loaded of workflows) {
    for (const trigger of loaded.workflow.triggers ?? []) {
      if (trigger.type === 'startup') {
        startupRuns += 1;
        void safeRun(loaded);
        continue;
      }

      if (!cron.validate(trigger.expression)) {
        throw new Error(`Invalid cron expression in ${loaded.filePath}: ${trigger.expression}`);
      }

      schedules += 1;
      cron.schedule(
        trigger.expression,
        () => void safeRun(loaded),
        {
          noOverlap: true,
          ...(trigger.timezone ? { timezone: trigger.timezone } : {}),
          name: loaded.workflow.name,
        },
      );
      log.info(
        `Scheduled ${loaded.workflow.name}: ${trigger.expression}${trigger.timezone ? ` (${trigger.timezone})` : ''}`,
      );
    }
  }

  log.success(
    `Watching ${workflows.length} workflow(s), ${schedules} cron schedule(s), ${startupRuns} startup trigger(s)`,
  );
  log.info('Press Ctrl+C to stop');

  await new Promise<void>((resolve) => {
    const stop = () => {
      cron.getTasks().forEach((task) => task.stop());
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
