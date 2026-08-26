import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from '../src/runner.js';
import type { LoadedWorkflow } from '../src/types.js';

test('dry-run does not execute shell commands', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'deskcron-dry-'));
  const marker = path.join(cwd, 'marker.txt');
  const previous = process.cwd();
  process.chdir(cwd);

  const loaded: LoadedWorkflow = {
    filePath: path.join(cwd, 'test.yml'),
    workflow: {
      version: 1,
      name: 'Dry run',
      steps: [{ run: `node -e "require('fs').writeFileSync(${JSON.stringify(marker)}, 'created')"` }],
    },
  };

  try {
    const record = await runWorkflow(loaded, { dryRun: true });
    assert.equal(record.status, 'dry-run');
    await assert.rejects(() => access(marker));
  } finally {
    process.chdir(previous);
    await rm(cwd, { recursive: true, force: true });
  }
});

test('retries a failed step and honors needs and if', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'deskcron-flow-'));
  const previous = process.cwd();
  process.chdir(cwd);

  const retryCommand = `node -e "const fs=require('fs');const p='attempt.txt';let n=fs.existsSync(p)?Number(fs.readFileSync(p,'utf8')):0;n++;fs.writeFileSync(p,String(n));if(n<2)process.exit(1);process.stdout.write('ready')"`;
  const loaded: LoadedWorkflow = {
    filePath: path.join(cwd, 'flow.yml'),
    workflow: {
      version: 1,
      name: 'Flow',
      steps: [
        {
          id: 'prepare',
          run: retryCommand,
          retry: { attempts: 2, delay_seconds: 0 },
          save_as: 'state',
        },
        {
          id: 'write',
          needs: ['prepare'],
          if: 'state == "ready"',
          run: `node -e "require('fs').writeFileSync('ran.txt','yes')"`,
        },
        {
          id: 'skip',
          needs: ['prepare'],
          if: 'state == "blocked"',
          run: `node -e "require('fs').writeFileSync('skipped.txt','no')"`,
        },
      ],
    },
  };

  try {
    const record = await runWorkflow(loaded, { recordHistory: false });
    assert.equal(record.status, 'success');
    assert.equal(record.steps[0]?.attempts, 2);
    assert.equal(record.steps[1]?.status, 'success');
    assert.equal(record.steps[2]?.status, 'skipped');
    await access(path.join(cwd, 'ran.txt'));
    await assert.rejects(() => access(path.join(cwd, 'skipped.txt')));
  } finally {
    process.chdir(previous);
    await rm(cwd, { recursive: true, force: true });
  }
});
