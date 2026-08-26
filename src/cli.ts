#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import cron from 'node-cron';
import { loadWorkflow, loadWorkflows, resolveWorkflow } from './config.js';
import { historyFile, readHistory } from './history.js';
import { formatDuration, log } from './logger.js';
import { ollamaAvailable } from './ollama.js';
import { runWorkflow } from './runner.js';
import { watchWorkflows } from './scheduler.js';

const DEFAULT_DIR = '.deskcron/workflows';
const VERSION = '0.2.0';
const program = new Command();

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function recipesDir(): string {
  return path.join(packageRoot(), 'recipes');
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    throw new Error('History limit must be between 1 and 500');
  }
  return parsed;
}

async function findRecipe(name: string): Promise<string> {
  const requested = name.toLowerCase().replace(/\.ya?ml$/i, '');
  const entries = await fs.readdir(recipesDir(), { withFileTypes: true });
  const match = entries.find(
    (entry) => entry.isFile() && entry.name.replace(/\.ya?ml$/i, '').toLowerCase() === requested,
  );
  if (!match) throw new Error(`Recipe not found: ${name}. Run "deskcron recipes" to list recipes.`);
  return path.join(recipesDir(), match.name);
}

program
  .name('deskcron')
  .description('Local-first workflow automation for developers')
  .version(VERSION);

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

    const starter = `version: 1\nname: Hello DeskCron\ndescription: A minimal local workflow\n\ntriggers:\n  - type: startup\n\nsteps:\n  - id: status\n    name: Show project status\n    run: git status --short\n    continue_on_error: true\n    save_as: git_status\n\n  - id: done\n    name: Notify completion\n    if: success()\n    needs: [status]\n    notify:\n      title: DeskCron\n      message: Starter workflow completed\n`;
    await fs.writeFile(file, starter, 'utf8');
    log.success(`Created ${path.relative(process.cwd(), file)}`);
    console.log('Next: deskcron validate && deskcron run hello --dry-run && deskcron run hello');
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
      console.log(
        `${loaded.workflow.name}\n  ${path.relative(process.cwd(), loaded.filePath)}\n  ${loaded.workflow.steps.length} step(s) · ${triggers}`,
      );
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
      log.success(`${path.relative(process.cwd(), loaded.filePath)} is valid`);
    }
  });

program
  .command('run <workflow>')
  .description('Run a workflow now')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .option('--dry-run', 'show the execution plan without running steps')
  .option('--no-history', 'do not append this run to local history')
  .action(async (
    workflow: string,
    options: { dir: string; dryRun?: boolean; history?: boolean },
  ) => {
    await runWorkflow(await resolveWorkflow(workflow, options.dir), {
      dryRun: options.dryRun ?? false,
      recordHistory: options.history !== false && !(options.dryRun ?? false),
    });
  });

program
  .command('watch')
  .description('Run startup triggers and keep cron workflows scheduled')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .action(async (options: { dir: string }) => {
    await watchWorkflows(options.dir);
  });

program
  .command('history')
  .description('Show recent workflow runs')
  .option('-n, --limit <number>', 'number of runs to show', '20')
  .option('-w, --workflow <name>', 'filter by workflow name')
  .option('--json', 'print raw JSON records')
  .action(async (options: { limit: string; workflow?: string; json?: boolean }) => {
    const records = await readHistory({
      limit: parseLimit(options.limit),
      ...(options.workflow ? { workflow: options.workflow } : {}),
    });

    if (options.json) {
      console.log(JSON.stringify(records, null, 2));
      return;
    }

    if (records.length === 0) {
      console.log('No run history yet.');
      return;
    }

    for (const record of records) {
      const when = new Date(record.started_at).toLocaleString();
      const failed = record.steps.filter((step) => step.status === 'failed').length;
      console.log(
        `${when}  ${record.status.padEnd(8)}  ${formatDuration(record.duration_ms).padEnd(8)}  ${record.workflow}${failed ? `  (${failed} failed step${failed === 1 ? '' : 's'})` : ''}`,
      );
    }
  });

program
  .command('recipes')
  .description('List bundled workflow recipes')
  .action(async () => {
    const entries = (await fs.readdir(recipesDir(), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const loaded = await loadWorkflow(path.join(recipesDir(), entry.name));
      console.log(`${entry.name.replace(/\.ya?ml$/i, '')}\n  ${loaded.workflow.description ?? loaded.workflow.name}`);
    }
  });

program
  .command('recipe <name>')
  .description('Copy a bundled recipe into the workflow directory')
  .option('-d, --dir <path>', 'workflow directory', DEFAULT_DIR)
  .option('-f, --force', 'overwrite an existing workflow')
  .action(async (name: string, options: { dir: string; force?: boolean }) => {
    const source = await findRecipe(name);
    const destinationDir = path.resolve(options.dir);
    const destination = path.join(destinationDir, path.basename(source));
    await fs.mkdir(destinationDir, { recursive: true });

    if (!options.force) {
      try {
        await fs.access(destination);
        throw new Error(`${destination} already exists. Use --force to overwrite it.`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    await fs.copyFile(source, destination);
    log.success(`Copied ${path.relative(process.cwd(), destination)}`);
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
    console.log(`History     ${historyFile()}`);
    const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    console.log(
      `Ollama      ${(await ollamaAvailable(ollamaHost)) ? `${ollamaHost} ✓` : `${ollamaHost} unavailable (optional)`}`,
    );
  });

program.showHelpAfterError();

program.parseAsync(process.argv).catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
