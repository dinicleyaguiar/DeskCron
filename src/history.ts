import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WorkflowRunRecord } from './types.js';

const HISTORY_RELATIVE = path.join('.deskcron', 'history', 'runs.jsonl');

export function historyFile(cwd = process.cwd()): string {
  return path.resolve(cwd, HISTORY_RELATIVE);
}

export async function appendHistory(record: WorkflowRunRecord, cwd = process.cwd()): Promise<void> {
  const file = historyFile(cwd);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readHistory(options: {
  cwd?: string;
  limit?: number;
  workflow?: string;
} = {}): Promise<WorkflowRunRecord[]> {
  const file = historyFile(options.cwd ?? process.cwd());
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const filter = options.workflow?.toLowerCase();
  const records: WorkflowRunRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as WorkflowRunRecord;
      if (filter && !record.workflow.toLowerCase().includes(filter)) continue;
      records.push(record);
    } catch {
      // Ignore a malformed history line rather than making history unusable.
    }
  }

  const limit = Math.max(1, Math.min(options.limit ?? 20, 500));
  return records.slice(-limit).reverse();
}
