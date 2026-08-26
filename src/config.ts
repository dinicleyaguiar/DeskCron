import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { workflowSchema } from './schema.js';
import type { LoadedWorkflow, Workflow } from './types.js';

const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);

export async function loadWorkflow(filePath: string): Promise<LoadedWorkflow> {
  const absolute = path.resolve(filePath);
  const raw = await fs.readFile(absolute, 'utf8');
  const parsed = YAML.parse(raw) as unknown;
  const result = workflowSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'workflow'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid workflow ${absolute}\n${issues}`);
  }

  return { filePath: absolute, workflow: result.data as Workflow };
}

export async function loadWorkflows(directory: string): Promise<LoadedWorkflow[]> {
  const absolute = path.resolve(directory);
  let entries;
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && YAML_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(absolute, entry.name))
    .sort();

  return Promise.all(files.map(loadWorkflow));
}

export async function resolveWorkflow(input: string, directory: string): Promise<LoadedWorkflow> {
  const direct = path.resolve(input);
  try {
    return await loadWorkflow(direct);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  for (const ext of ['', '.yml', '.yaml']) {
    const candidate = path.resolve(directory, `${input}${ext}`);
    try {
      return await loadWorkflow(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  throw new Error(`Workflow not found: ${input}`);
}
