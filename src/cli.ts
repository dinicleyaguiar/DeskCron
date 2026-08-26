#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import cron from 'node-cron';
import { loadWorkflow, loadWorkflows, resolveWorkflow } from './config.js';
import { log } from './logger.js';
import { ollamaAvailable } from './ollama.js';
import { runWorkflow } from './runner.js';
import { watchWorkflows } from './scheduler.js';

const DEFAULT_DIR = '.deskcron/workflows';
const program = new Command();

program
  .name('deskcron')
  .description('Local-first workflow automation for developers')
  .version('0.1.0');

program
  .command('init')
  .description('Create a starter .deskcron workspace')
  .option('-f, --force', 'overwrite the starter workflow')
  .action(async (options: { force?: boolean }) => {
    const dir = path.resolve(DEFAULT_DIR);
    const file = path.join(dir, 'hello.yml');
    await fs.mkdir(dir, { recursive: true });

    try {
      if (!options.force) await fs.access(file);
      if (!options.force) {
        log.warn(`${file} already exists. Use --force to overwrite it.`);
        return;
      }
    } catch {
      // File does not exist; continue.
    }

    const starter = `version: 1\nname: Hello DeskCron\ndescription: A minimal local workflow\n\ntriggers:\n  - type: startup\n\nsteps:\n  - name: Show project status\n    run: git status --short\n    continue_on_error: true\n\n  - notify:\n      title: DeskCron\n      message: Starter workflow completed\n`;
    await fs.writeFile(file, starter, 'utf8');
    log.ok(`Created ${path.relative(process.cwd(), file)}`);
    console.log('Next: deskcron validate && deskcron run hello');
  });

program
  .command('list')
  .description('List workflows')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .action(async (options: { dir: string }) => {
    const workflows = await loadWorkflows(options.dir);
    if (workflows.length === 0) {
      console.log('No workflows found.');
      return;
    }

    for (const loaded of workflows) {
      const triggers = (loaded.workflow.triggers ?? [])
        .map((trigger) => trigger.type === 'startup' ? 'startup' : `cron ${trigger.expression}`)
        .join(', ') || 'manual';
      console.log(`${loaded.workflow.name}\n  ${path.relative(process.cwd(), loaded.filePath)}\n  ${triggers}`);
    }
  });

program
  .command('validate [workflow]')
  .description('Validate one workflow or every workflow in the directory')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .action(async (workflow: string | undefined, options: { dir: string }) => {
    const workflows = workflow
      ? [await resolveWorkflow(workflow, options.dir)]
      : await loadWorkflows(options.dir);

    if (workflows.length === 0) throw new Error(`No workflows found in ${options.dir}`);

    for (const loaded of workflows) {
      for (const trigger of loaded.workflow.triggers ?? []) {
        if (trigger.type === 'cron' && !cron.validate(trigger.expression)) {
          throw new Error(`Invalid cron expression in ${loaded.filePath}: ${trigger.expression}`);
        }
      }
      log.ok(`${path.relative(process.cwd(), loaded.filePath)} is valid`);
    }
  });

program
  .command('run <workflow>')
  .description('Run a workflow now')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .action(async (workflow: string, options: { dir: string }) => {
    await runWorkflow(await resolveWorkflow(workflow, options.dir));
  });

program
  .command('watch')
  .description('Run startup triggers and keep cron workflows scheduled')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .action(async (options: { dir: string }) => {
    await watchWorkflows(options.dir);
  });

program
  .command('doctor')
  .description('Check the local DeskCron environment')
  .action(async () => {
    console.log(`Node        ${process.version} ✓`);
    const workflowDir = path.resolve(DEFAULT_DIR);
    try {
      await fs.access(workflowDir);
      console.log(`Workflows   ${workflowDir} ✓`);
    } catch {
      console.log(`Workflows   ${workflowDir} not found (run deskcron init)`);
    }
    const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    console.log(`Ollama      ${(await ollamaAvailable(ollamaHost)) ? `${ollamaHost} ✓` : `${ollamaHost} unavailable (optional)`}`);
  });

program.showHelpAfterError();

program.parseAsync(process.argv).catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
