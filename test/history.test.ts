import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendHistory, readHistory } from '../src/history.js';
import type { WorkflowRunRecord } from '../src/types.js';

test('writes and reads local run history', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'deskcron-history-'));
  const record: WorkflowRunRecord = {
    id: 'run-1',
    workflow: 'Test workflow',
    file: '/tmp/test.yml',
    cwd,
    started_at: new Date(0).toISOString(),
    finished_at: new Date(1000).toISOString(),
    duration_ms: 1000,
    status: 'success',
    dry_run: false,
    steps: [],
  };

  try {
    await appendHistory(record, cwd);
    const records = await readHistory({ cwd, limit: 10 });
    assert.equal(records.length, 1);
    assert.equal(records[0]?.workflow, 'Test workflow');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
